import json
from django.core.management.base import BaseCommand, CommandError
from api.services.ingestion import asset_type, ingest_market_data
from api.services.market_data import validate_symbol

class Command(BaseCommand):
    help = 'Fetch adjusted historical bars and update persistent market records.'

    def add_arguments(self, parser):
        parser.add_argument('--symbols', nargs='+', help='Optional ticker list, e.g. QQQ SPY')

    def handle(self, *args, **options):
        try:
            symbols = options.get('symbols')
            targets = {validate_symbol(s): asset_type(validate_symbol(s)) for s in symbols} if symbols else None
            result = ingest_market_data(targets)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(result))
        if result['failed']:
            raise CommandError('Some symbols failed; details are in the JSON report above.')
