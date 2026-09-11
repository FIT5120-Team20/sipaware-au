"""Catalog boundaries: exact categories, literal search, safe pages and sanitized failures."""
import asyncio
from contextlib import contextmanager
from unittest.mock import Mock
import httpx
import pytest
from app.api.catalog import get_catalog_repository
from app.main import app
from app.schemas.catalog import CatalogPage
from app.services.catalog_repository import CatalogRepository, CatalogDataIntegrityError
from app.integrations.database import DatabaseUnavailableError


def sample(**updates):
    return {**dict(product_id='fixture', drink_name='Test beer', category_id=1, volume_ml=330,
                   abv_percent=5, source_name='Synthetic source', source_url='https://example.org/data'), **updates}


class Connection:
    def __init__(self, rows):
        self.rows, self.calls, self.closed = rows, [], False
    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        return self
    def fetchone(self):
        return {'total': len(self.rows)}
    def fetchall(self):
        return self.rows
    @contextmanager
    def connect(self):
        try:
            yield self
        finally:
            self.closed = True


@pytest.mark.parametrize('category,ids', [('all',list(range(1,9))),('beer',[1]),('wine',[2]),('spirits',[4]),('cider',[3]),('rtd',[5]),('other',[6,7,8])])
def test_category_query_is_bounded_and_does_not_join_barcodes(category,ids):
    db=Connection([sample()])
    page=CatalogRepository(db.connect).browse(category, "50%_! ' OR 1=1",24,24)
    sql,params=db.calls[-1]
    assert params == (ids,"%50!%!_!! ' OR 1=1%","%50!%!_!! ' OR 1=1%",24,24)
    assert 'drink_product_barcode' not in sql and 'LIMIT %s OFFSET %s' in sql
    assert 'ORDER BY lower(p.product_name), p.product_key' in sql
    assert 'p.is_active = TRUE' in sql
    assert "OR 1=1" not in sql
    assert db.calls[0][0] == 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
    assert page.products[0].volume_ml == 330 and db.closed


@pytest.mark.parametrize('change',[{'volume_ml':0},{'abv_percent':101},{'category_id':99},{'source_url':'javascript:alert(1)'},{'source_name':None},{'product_id':''}])
def test_corrupt_rows_do_not_become_wrong_drinks(change):
    with pytest.raises(CatalogDataIntegrityError):
        CatalogRepository(Connection([sample(**change)]).connect).browse('all','',0,24)


@pytest.fixture
def repository():
    repo=Mock()
    app.dependency_overrides[get_catalog_repository]=lambda:repo
    yield repo
    app.dependency_overrides.pop(get_catalog_repository,None)


def request(params=None,method='GET'):
    async def send():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            return await client.request(method,'/api/drinks/catalog',params=params)
    return asyncio.run(send())


def test_default_browse_and_empty_success(repository):
    repository.browse.return_value=CatalogPage(products=[],total=0,offset=0,limit=24)
    r=request()
    assert r.status_code==200 and r.json()=={'products':[],'total':0,'offset':0,'limit':24}
    assert r.headers['Cache-Control']=='no-store'
    repository.browse.assert_called_once_with('all','',0,24)


@pytest.mark.parametrize('params',[{'category':'unknown'},{'offset':-1},{'limit':49},{'limit':0},{'q':'a'*201}])
def test_invalid_query_rejected_before_database(repository,params):
    assert request(params).status_code==422
    repository.browse.assert_not_called()


def test_database_failure_is_retryable_not_empty(repository):
    repository.browse.side_effect=DatabaseUnavailableError('private-driver-value')
    r=request()
    assert r.status_code==503 and 'private-driver-value' not in r.text
    assert 'temporarily unavailable' in r.text


def test_catalog_has_no_write_endpoint(repository):
    assert request(method='POST').status_code==405
    repository.browse.assert_not_called()
