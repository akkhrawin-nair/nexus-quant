import json
import os
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import SimpleTestCase


class OptionsAccessTests(SimpleTestCase):
    def report(self, environment):
        output = StringIO()
        with patch.dict(os.environ, environment, clear=True):
            call_command('check_options_access', stdout=output)
        return json.loads(output.getvalue()), output.getvalue()

    def test_missing_credentials_identifies_setup_needed(self):
        report, _ = self.report({})
        self.assertEqual(report['status'], 'credentials_missing')
        self.assertEqual(report['missing_variables'], ['WEBULL_APP_KEY', 'WEBULL_APP_SECRET'])
        self.assertFalse(report['live_quotes_verified'])

    def test_partial_or_whitespace_credentials_are_incomplete(self):
        report, _ = self.report({'WEBULL_APP_KEY': 'local-test-key', 'WEBULL_APP_SECRET': '  '})
        self.assertEqual(report['missing_variables'], ['WEBULL_APP_SECRET'])
        self.assertEqual(report['status'], 'credentials_missing')

    def test_credentials_never_imply_live_data_and_are_not_printed(self):
        report, output = self.report({
            'WEBULL_APP_KEY': 'private-test-key-123',
            'WEBULL_APP_SECRET': 'private-test-secret-456',
        })
        self.assertEqual(report['status'], 'credentials_present_unverified')
        self.assertEqual(report['missing_variables'], [])
        self.assertFalse(report['live_quotes_verified'])
        self.assertIn('OPRA', ' '.join(report['remaining_checks']))
        self.assertNotIn('private-test-key-123', output)
        self.assertNotIn('private-test-secret-456', output)
