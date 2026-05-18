"""
Centralized logging configuration for the WebMining ML Pipeline.
All modules import `get_logger(__name__)` for consistent formatting.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path


def get_logger(name: str, config: dict = None) -> logging.Logger:
    """
    Return a configured logger instance.

    Args:
        name:   Logger name, typically __name__
        config: Optional logging config dict from config.yaml

    Returns:
        Configured Logger instance (cached by Python's logging module)
    """
    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    # Defaults
    level = logging.INFO
    log_file = "logs/pipeline.log"
    max_bytes = 10 * 1024 * 1024   # 10 MB
    backup_count = 5

    if config:
        level = getattr(logging, config.get("level", "INFO").upper(), logging.INFO)
        log_file = config.get("file", log_file)
        max_bytes = config.get("max_bytes", max_bytes)
        backup_count = config.get("backup_count", backup_count)

    logger.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ── Console handler ──────────────────────────────────────
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # ── Rotating file handler ────────────────────────────────
    log_dir = Path(log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)

    file_handler = RotatingFileHandler(
        log_file, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger
