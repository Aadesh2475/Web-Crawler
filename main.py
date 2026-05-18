"""
WebMining ML Pipeline — Main CLI Entry Point

Commands
--------
  crawl      Run crawl → clean → filter → summarise → save (once)
  embed      Embed un-indexed articles into FAISS (once)
  query      Ask a question against the knowledge base (RAG)
  schedule   Start the automated scheduler (runs indefinitely)
  api        Start the Flask API server only
  all        Start scheduler + API together (recommended for production)

Examples
--------
  python main.py crawl
  python main.py embed
  python main.py query --question "What is quantum computing?"
  python main.py schedule
  python main.py api
  python main.py all
"""

import argparse
import sys
import threading
import time
from pathlib import Path

import yaml
from dotenv import load_dotenv

# ── Environment & path setup ─────────────────────────────────────────────────
load_dotenv()
sys.path.insert(0, str(Path(__file__).parent))

from utils.logger import get_logger

logger = get_logger(__name__)


# ── Config loader ─────────────────────────────────────────────────────────────

def load_config(path: str = "config.yaml") -> dict:
    cfg_path = Path(path)
    if not cfg_path.exists():
        logger.error(f"Config file not found: {cfg_path.resolve()}")
        sys.exit(1)
    with open(cfg_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


# ── Component initialisation ──────────────────────────────────────────────────

def init_components(config: dict):
    """
    Instantiate and wire every pipeline component.

    Returns (db, vector_store, embedder, rag, orchestrator).
    """
    from embedding.embedder import EmbeddingAgent
    from rag.retriever import RAGRetriever
    from scheduler.pipeline import PipelineOrchestrator
    from storage.db import DatabaseManager
    from storage.vector_store import VectorStore

    logger.info("Initialising pipeline components ...")

    db           = DatabaseManager(config)
    db.create_tables()

    vector_store = VectorStore(config)
    embedder     = EmbeddingAgent(config)
    rag          = RAGRetriever(config, embedder, vector_store, db)
    orchestrator = PipelineOrchestrator(config, db, vector_store)

    logger.info("All components ready.")
    return db, vector_store, embedder, rag, orchestrator


# ── CLI commands ───────────────────────────────────────────────────────────────

def cmd_crawl(config: dict) -> None:
    """Run the full ingestion pipeline once and print a summary."""
    _, _, _, _, orchestrator = init_components(config)
    stats = orchestrator.run_ingestion_pipeline()

    print("\n" + "=" * 50)
    print("  Pipeline Run Summary")
    print("=" * 50)
    for key, val in stats.items():
        print(f"  {key:<25} {val}")
    print("=" * 50)


def cmd_embed(config: dict) -> None:
    """Embed un-indexed articles and update the FAISS index."""
    _, _, _, _, orchestrator = init_components(config)
    count = orchestrator.run_embedding_update()
    print(f"\n[OK] {count} articles newly embedded into FAISS.")


def cmd_query(config: dict, question: str) -> None:
    """Run a RAG query and print the answer with sources."""
    db, vector_store, embedder, rag, _ = init_components(config)
    result = rag.query(question)

    bar = "═" * 60
    print(f"\n{bar}")
    print(f"  Question: {question}")
    print(bar)
    print(f"\n  Answer:\n  {result['answer']}\n")
    sources = result.get("sources", [])
    if sources:
        print(f"  Sources ({len(sources)}):")
        for i, src in enumerate(sources, 1):
            print(
                f"    {i}. [{src['source']}] {src['title']} "
                f"(similarity={src['similarity']:.3f})"
            )
            print(f"       {src['url']}")
    print(bar)


def cmd_schedule(config: dict) -> None:
    """
    Start the automated scheduler.
    Runs the pipeline immediately on startup, then on the configured interval.
    Press Ctrl+C to stop.
    """
    _, _, _, _, orchestrator = init_components(config)
    orchestrator.start()

    logger.info("Running initial pipeline pass ...")
    orchestrator.run_ingestion_pipeline()
    orchestrator.run_embedding_update()

    print("\n[OK] Scheduler is running. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        orchestrator.stop()
        logger.info("Scheduler stopped by user.")


def cmd_api(config: dict) -> None:
    """Start the Flask API server (blocking)."""
    db, vector_store, _, rag, orchestrator = init_components(config)

    from api.app import create_app
    app     = create_app(config, orchestrator, rag, db)
    api_cfg = config.get("api", {})
    host    = api_cfg.get("host", "0.0.0.0")
    port    = int(api_cfg.get("port", 5000))
    debug   = api_cfg.get("debug", False)

    logger.info(f"Starting Flask API on http://{host}:{port}")
    print(f"\n[OK] API running -> http://{host}:{port}\n")
    app.run(host=host, port=port, debug=debug, use_reloader=False)


def cmd_all(config: dict) -> None:
    """
    Start everything:
      • Scheduler (background thread, runs pipeline hourly)
      • Flask API (foreground, blocking)

    Press Ctrl+C to stop everything.
    """
    db, vector_store, _, rag, orchestrator = init_components(config)

    # Start scheduler
    orchestrator.start()

    # Run initial pipeline pass in a background thread so API starts quickly
    def _initial_pass():
        logger.info("Running initial ingestion pass ...")
        orchestrator.run_ingestion_pipeline()
        orchestrator.run_embedding_update()

    threading.Thread(target=_initial_pass, daemon=True).start()

    # Start API
    from api.app import create_app
    app     = create_app(config, orchestrator, rag, db)
    api_cfg = config.get("api", {})
    host    = api_cfg.get("host", "0.0.0.0")
    port    = int(api_cfg.get("port", 5000))
    debug   = api_cfg.get("debug", False)

    print(f"\n[OK] System running:")
    print(f"    API         ->  http://{host}:{port}")
    print(f"    Scheduler   ->  ingestion every "
          f"{config.get('scheduler',{}).get('ingestion_interval_hours',1)}h")
    print("    Press Ctrl+C to stop.\n")

    try:
        app.run(host=host, port=port, debug=debug, use_reloader=False)
    except KeyboardInterrupt:
        pass
    finally:
        orchestrator.stop()
        logger.info("System stopped.")


# ── Argument parser ───────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog        = "python main.py",
        description = "WebMining ML Pipeline — automated data collection, "
                      "summarisation, and RAG querying.",
        formatter_class = argparse.RawDescriptionHelpFormatter,
        epilog = """
Examples:
  python main.py crawl
  python main.py embed
  python main.py query --question "What is the latest in AI research?"
  python main.py schedule
  python main.py api
  python main.py all
        """,
    )
    parser.add_argument(
        "command",
        choices = ["crawl", "embed", "query", "schedule", "api", "all"],
        help    = "Pipeline command to execute.",
    )
    parser.add_argument(
        "--config", "-c",
        default = "config.yaml",
        help    = "Path to config.yaml (default: config.yaml)",
    )
    parser.add_argument(
        "--question", "-q",
        default = None,
        help    = "Question string for the 'query' command.",
    )
    return parser


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()
    config = load_config(args.config)

    # Apply logging config early so all modules pick it up
    log_cfg = config.get("logging", {})
    get_logger("__main__", log_cfg)

    dispatch = {
        "crawl":    lambda: cmd_crawl(config),
        "embed":    lambda: cmd_embed(config),
        "query":    lambda: cmd_query(config, args.question or ""),
        "schedule": lambda: cmd_schedule(config),
        "api":      lambda: cmd_api(config),
        "all":      lambda: cmd_all(config),
    }

    if args.command == "query" and not args.question:
        parser.error("--question / -q is required for the 'query' command.")

    dispatch[args.command]()

if __name__ == "__main__":
    main()
