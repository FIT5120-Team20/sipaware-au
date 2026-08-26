# Infrastructure Placeholder

The currently intended future hosting direction is:

- Frontend: AWS Amplify
- Backend: AWS Elastic Beanstalk
- Official/public reference database: Amazon RDS for PostgreSQL
- Transport security: AWS-managed HTTPS infrastructure, as appropriate to the final design

Cloud deployment is not implemented in this bootstrap. This directory intentionally contains no infrastructure-as-code, AWS credentials, resource configuration, or deployment scripts.

Personal drinking records must not be stored in the reference database.
