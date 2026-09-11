"""Synthetic repository checks: text identity, packaging and read-only query."""
from contextlib import contextmanager
from decimal import Decimal

import pytest

from app.services.barcode_repository import BarcodeDataIntegrityError, BarcodeRepository


def sample(**changes):
    return dict(product_id="test-product", barcode="00024594", drink_name="Test drink",
                category_id=1, volume_ml=Decimal("330"), abv_percent=Decimal("5"),
                pack_quantity=6, total_package_volume_ml=Decimal("1980"),
                source_name="Synthetic source", source_url="https://example.org/data", **changes)


class Connection:
    def __init__(self, rows):
        self.rows, self.calls, self.closed = rows, [], False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        self.params = params
        return self

    def fetchone(self):
        return self.rows.get(self.params[0])

    @contextmanager
    def connect(self):
        try:
            yield self
        finally:
            self.closed = True


def test_exact_text_match_and_read_only_parameterized_query():
    db = Connection({"00024594": sample()})
    result = BarcodeRepository(db.connect).find_by_barcode("00024594")
    assert result.barcode == "00024594"
    assert result.volume_ml == 330 and result.pack_quantity == 6
    assert result.total_package_volume_ml == 1980
    sql, params = db.calls[-1]
    assert params == ("00024594",)
    assert "00024594" not in sql
    assert "b.barcode = %s" in sql and "p.is_active = TRUE" in sql
    assert all(not any(word in query.upper() for word in ("INSERT", "UPDATE", "DELETE")) for query, _ in db.calls)
    assert db.closed


@pytest.mark.parametrize("barcode", ["24594", "000024594", "not-a-barcode", "' OR 1=1 --"])
def test_no_numeric_cast_alias_or_approximate_fallback(barcode):
    db = Connection({"00024594": sample()})
    assert BarcodeRepository(db.connect).find_by_barcode(barcode) is None
    assert db.calls[-1][1] == (barcode,)
    assert len(db.calls) == 2


def test_different_sales_packs_keep_same_product_and_single_container():
    six = sample()
    twelve = {**six, "barcode": "12345678", "pack_quantity": 12, "total_package_volume_ml": 3960}
    db = Connection({"00024594": six, "12345678": twelve})
    repo = BarcodeRepository(db.connect)
    a, b = repo.find_by_barcode("00024594"), repo.find_by_barcode("12345678")
    assert a.product_id == b.product_id
    assert a.volume_ml == b.volume_ml == 330
    assert a.pack_quantity == 6 and b.pack_quantity == 12


@pytest.mark.parametrize("change", [
    {"category_id": 99}, {"volume_ml": 0}, {"volume_ml": Decimal("NaN")},
    {"abv_percent": 101}, {"pack_quantity": 0}, {"pack_quantity": 1.5},
    {"total_package_volume_ml": 330}, {"source_name": None},
    {"source_url": "javascript:alert(1)"},
    {"barcode": "24594"}, {"drink_name": ""},
])
def test_bad_catalog_data_is_not_a_confirmed_miss(change):
    db = Connection({"00024594": {**sample(), **change}})
    with pytest.raises(BarcodeDataIntegrityError, match="unavailable"):
        BarcodeRepository(db.connect).find_by_barcode("00024594")
    assert db.closed
