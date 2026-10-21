import signal
import sys
from django.core.management.base import BaseCommand, CommandError
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from api.scheduler import run_market_data_ingestion_job, logger


class Command(BaseCommand):
    help = 'Boots the autonomous market data ingestion background scheduler (APScheduler).'

    def add_arguments(self, parser):
        parser.add_argument('--timezone', default='America/New_York', help='IANA timezone for cron scheduling.')
        parser.add_argument(
            '--interval',
            type=int,
            default=0,
            help='Run the ingestion job continuously every N seconds (ideal for dev/testing).'
        )
        parser.add_argument(
            '--cron',
            type=str,
            default='16:30',
            help='Weekday cron time in HH:MM format (default: 16:30 America/New_York; holidays are not filtered).'
        )
        parser.add_argument(
            '--run-now',
            action='store_true',
            help='Execute an immediate ingestion cycle upon starting the scheduler.'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        cron_time = options['cron']
        run_now = options['run_now']
        if interval < 0 or (interval and interval < 60):
            raise CommandError('--interval must be 0 or at least 60 seconds.')
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            schedule_zone = ZoneInfo(options['timezone'])
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise CommandError('Invalid IANA timezone. Install tzdata on Windows if needed.') from exc

        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING(" KAPPA ANALYTICS AUTONOMOUS MARKET SCHEDULER WORKER "))
        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))


        if run_now:
            self.stdout.write(self.style.WARNING("[!] Initializing Immediate Ingestion Run..."))
            try:
                run_market_data_ingestion_job()
            except Exception as e:
                logger.error(f"Error during immediate ingestion run: {e}")

        scheduler = BlockingScheduler(timezone=schedule_zone)

        if interval > 0:
            trigger = IntervalTrigger(seconds=interval)
            self.stdout.write(self.style.SUCCESS(f"[+] Scheduler Trigger Mode: INTERVAL (Every {interval} seconds)"))
        else:
            try:
                hour, minute = cron_time.split(':')
                trigger = CronTrigger(hour=int(hour), minute=int(minute), day_of_week='mon-fri', timezone=schedule_zone)
                self.stdout.write(self.style.SUCCESS(f"[+] Scheduler Trigger Mode: DAILY CRON (At {cron_time} Daily)"))
            except Exception:
                self.stdout.write(self.style.ERROR(f"[X] Invalid --cron format '{cron_time}'. Use HH:MM format."))
                sys.exit(1)

        scheduler.add_job(
            run_market_data_ingestion_job,
            trigger=trigger,
            id='market_data_ingestion_job',
            name='Daily Market Data & Technical Analysis Pipeline',
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300,
        )

        def shutdown_handler(signum, frame):
            self.stdout.write(self.style.WARNING("\n[!] Gracefully shutting down NEXUS QUANT Scheduler..."))
            if scheduler.running:
                scheduler.shutdown(wait=False)
            self.stdout.write(self.style.SUCCESS("[+] Scheduler terminated cleanly."))
            sys.exit(0)

        signal.signal(signal.SIGINT, shutdown_handler)
        signal.signal(signal.SIGTERM, shutdown_handler)

        self.stdout.write(self.style.SUCCESS("[+] Scheduler background worker active. Press Ctrl+C to terminate.\n"))
        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            shutdown_handler(None, None)
