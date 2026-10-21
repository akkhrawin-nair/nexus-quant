"""Offline prerequisite check; deliberately does not claim provider connectivity."""
import json
import os

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Check local Webull credential presence without revealing secrets or contacting a broker.'

    def handle(self, *args, **options):
        required = ('WEBULL_APP_KEY', 'WEBULL_APP_SECRET')
        missing = [name for name in required if not os.environ.get(name, '').strip()]
        report = {
            'provider': 'Webull',
            'account_country': 'Thailand',
            'check_type': 'offline_prerequisites_only',
            'status': 'credentials_missing' if missing else 'credentials_present_unverified',
            'missing_variables': missing,
            'live_quotes_verified': False,
            'remaining_checks': [
                'Confirm Webull Thailand OpenAPI application approval and account-specific endpoint.',
                'Confirm OPRA options market-data access for this API application; app subscriptions are separate.',
                'Complete any required Webull authentication or token activation.',
                'Implement and test a read-only options quote request against the approved endpoint.',
                'Verify exact contract, bid/ask timestamps, quote freshness, and market-data entitlement.',
            ],
            'setup_guide': 'docs/webull-thailand-options-setup.md',
        }
        self.stdout.write(json.dumps(report, indent=2))
