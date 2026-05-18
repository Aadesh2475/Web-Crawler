"""
One-time database setup script.

Run this BEFORE starting the pipeline for the first time.
It creates all PostgreSQL tables (articles, pipeline_runs) if they
don't already exist, then prints current aggregate stats.

Usage:
    python setup_db.py
    python setup_db.py --config path/to/config.yaml
"""

import argparse
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from storage.db import DatabaseManager
from utils.logger import get_logger

logger = get_logger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up the WebMining database.")
    parser.add_argument(
        "--config", "-c",
        default = "config.yaml",
        help    = "Path to config.yaml",
    )
    args = parser.parse_args()

    cfg_path = Path(args.config)
    if not cfg_path.exists():
        logger.error(f"Config not found: {cfg_path.resolve()}")
        sys.exit(1)

    with open(cfg_path, "r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh)

    logger.info("Connecting to database ...")
    db = DatabaseManager(config)

    logger.info("Creating tables ...")
    db.create_tables()

    stats = db.get_stats()
    print("\n[OK] Database setup complete!\n")
    print("  Current stats:")
    for key, val in stats.items():
        print(f"    {key:<30} {val}")
    print()


if __name__ == "__main__":
    main()
