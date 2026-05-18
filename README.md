# WebMining ML Pipeline

An autonomous, end-to-end machine-learning system that **continuously crawls** News, Wikipedia, and Reddit, **filters and summarises** the content, stores it in a **PostgreSQL + FAISS** knowledge base, and answers questions via a **RAG (Retrieval-Augmented Generation)** pipeline — all served through a **Flask REST API** and scheduled automatically.

---

## Architecture

```
User Input (Topic / Query)
        │
        ▼
┌──────────────────────┐
│  Data Ingestion      │  News (NewsAPI + RSS) · Wikipedia · Reddit
│  (crawler/)          │
└──────────┬───────────┘
           │ raw articles (JSON)
           ▼
┌──────────────────────┐
│  Cleaning Agent      │  HTML strip · boilerplate removal · unicode normalise
│  (processing/)       │
└──────────┬───────────┘
           │ cleaned text
           ▼
┌──────────────────────┐
│  Filtering Agent     │  Keyword score → zero-shot BERT/MNLI classifier
│  (filtering/)        │
└──────────┬───────────┘
           │ relevant articles
           ▼
┌──────────────────────┐
│  Summarisation Agent │  DistilBART (sshleifer/distilbart-cnn-12-6) on CPU
│  (processing/)       │
└──────────┬───────────┘
           │ summaries
           ▼
┌──────────────────────┐      ┌──────────────┐
│  Storage Agent       │─────▶│  PostgreSQL  │  structured data
│  (storage/)          │      └──────────────┘
└──────────┬───────────┘
           │ embed summaries
           ▼
┌──────────────────────┐      ┌──────────────┐
│  Embedding Agent     │─────▶│  FAISS index │  vector search
│  (embedding/)        │      └──────────────┘
└──────────────────────┘

           Query time:
┌──────────────────────┐
│  RAG Retriever       │  embed query → FAISS search → Flan-T5 answer
│  (rag/)              │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Flask API           │  POST /query  POST /retrieve  POST /pipeline/run …
│  (api/)              │
└──────────────────────┘

Scheduler (APScheduler):
  • Ingestion every 1 h (configurable)
  • Embedding update 30 min after ingestion
  • Weekly cleanup every Sunday 02:00 UTC
```

---

## Models Used (all CPU-optimized)

| Role | Model | Why |
|---|---|---|
| Summarisation | `sshleifer/distilbart-cnn-12-6` | 2× faster than full BART, < 5 % ROUGE loss |
| Content filtering | `typeform/distilbert-base-uncased-mnli` | Zero-shot NLI on CPU |
| Embeddings | `all-MiniLM-L6-v2` | 384-dim, ~14 k sentences/min on CPU |
| RAG generation | `google/flan-t5-base` | Instruction-tuned, runs on CPU |

---

## Quick Start

### 1 — Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10 + |
| PostgreSQL | 14 + |
| RAM | ≥ 8 GB (16 GB recommended) |
| Disk | ≥ 5 GB (models + data) |

### 2 — Install dependencies

```bash
cd "ML Model"
pip install -r requirements.txt
```

> **Tip (Windows):** if `faiss-cpu` fails to install with pip, try:
> ```bash
> pip install faiss-cpu --prefer-binary
> ```

### 3 — Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

**Minimum required** (without Reddit or NewsAPI the pipeline still works using free RSS feeds and Wikipedia):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webmining_db
DB_USER=postgres
DB_PASSWORD=your_password
```

**Optional API keys** (significantly improves news coverage):
- **NewsAPI** free key → https://newsapi.org/register
- **Reddit API** → https://www.reddit.com/prefs/apps (create a "script" app)

### 4 — Edit topics (optional)

Open `config.yaml` and update the `topics` list:

```yaml
topics:
  - "artificial intelligence"
  - "climate change"
  - "space exploration"
```

### 5 — Create the database

```bash
# Create the database in PostgreSQL first:
psql -U postgres -c "CREATE DATABASE webmining_db;"

# Then run the setup script:
python setup_db.py
```

### 6 — Run

```bash
# Run everything (scheduler + API) — recommended
python main.py all

# Or step by step:
python main.py crawl      # Crawl → clean → filter → summarise → save
python main.py embed      # Embed articles into FAISS
python main.py query -q "What are the latest AI breakthroughs?"
python main.py schedule   # Automated scheduler only
python main.py api        # Flask API only
```

---

## API Reference

Base URL: `http://localhost:5000`

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/status` | Scheduler jobs, DB stats, FAISS size |
| GET | `/topics` | List configured topics |
| GET | `/stats` | DB aggregate counts |

### Knowledge Base

| Method | Endpoint | Body / Params | Description |
|--------|----------|---------------|-------------|
| GET | `/articles` | `?topic=ai&limit=20` | List articles for topic |
| POST | `/query` | `{"question": "...", "top_k": 5}` | RAG: question → answer + sources |
| POST | `/retrieve` | `{"query": "...", "top_k": 5}` | Semantic retrieval only (no LLM) |

### Pipeline Control

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/pipeline/run` | `{"topics": [...]}` (optional) | Trigger ingestion now |
| POST | `/pipeline/embed` | — | Trigger embedding update |
| POST | `/pipeline/cleanup` | — | Mark stale articles outdated |

### Example: Query the knowledge base

```bash
curl -X POST http://localhost:5000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the main applications of large language models?", "top_k": 5}'
```

Response:
```json
{
  "status": "success",
  "data": {
    "answer": "Large language models are applied in ...",
    "sources": [
      {"title": "GPT-4 Technical Report", "source": "news", "similarity": 0.923},
      ...
    ]
  }
}
```

### Example: Trigger pipeline via API

```bash
# Custom topic ingestion
curl -X POST http://localhost:5000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"topics": ["quantum computing"]}'
```

---

## Project Structure

```
ML Model/
├── api/                  Flask REST API
│   └── app.py
├── crawler/              Data ingestion agents
│   ├── base_crawler.py
│   ├── news_crawler.py
│   ├── wiki_crawler.py
│   └── reddit_crawler.py
├── embedding/            SentenceTransformer embedding agent
│   └── embedder.py
├── filtering/            Two-stage content filter (keyword + BERT)
│   └── content_filter.py
├── processing/           Cleaning + DistilBART summarisation
│   ├── cleaner.py
│   └── summarizer.py
├── rag/                  RAG pipeline (FAISS → Flan-T5)
│   └── retriever.py
├── scheduler/            APScheduler orchestrator
│   └── pipeline.py
├── storage/              PostgreSQL ORM + FAISS vector store
│   ├── db.py
│   └── vector_store.py
├── utils/                Logger + metrics helpers
│   ├── logger.py
│   └── metrics.py
├── data/                 FAISS index files (auto-created)
├── logs/                 Rotating log files (auto-created)
├── config.yaml           All configuration
├── requirements.txt
├── .env.example          → copy to .env
├── setup_db.py           One-time DB initialisation
└── main.py               CLI entry point
```

---

## Configuration Reference (`config.yaml`)

| Key | Default | Description |
|-----|---------|-------------|
| `topics` | `["artificial intelligence", ...]` | Topics to crawl |
| `sources.news.enabled` | `true` | Enable news crawling |
| `sources.news.api_key` | `""` | NewsAPI key (or use RSS) |
| `sources.wikipedia.max_pages_per_topic` | `5` | Wikipedia pages per topic |
| `sources.reddit.enabled` | `true` | Enable Reddit crawling |
| `models.summarizer` | `sshleifer/distilbart-cnn-12-6` | Summarization model |
| `models.embedder` | `all-MiniLM-L6-v2` | Embedding model |
| `models.rag_generator` | `google/flan-t5-base` | RAG answer model |
| `models.classifier_threshold` | `0.55` | Min relevance score |
| `scheduler.ingestion_interval_hours` | `1` | How often to crawl |
| `scheduler.max_article_age_days` | `30` | Articles older than this are retired |
| `api.port` | `5000` | Flask API port |

---

## Evaluation Metrics

Run ROUGE evaluation on a batch of summaries:

```python
from utils.metrics import compute_rouge_scores

scores = compute_rouge_scores(predictions=my_summaries, references=source_texts)
# {"rouge1": 0.42, "rouge2": 0.21, "rougeL": 0.38}
```

Pipeline timing / counters are logged automatically at the end of every run.

---

## Adding a New Data Source

1. Create `crawler/my_crawler.py` extending `BaseCrawler`
2. Implement `fetch(topic) → List[Dict]` returning the standard schema
3. Add your crawler to the `self.crawlers` list in `scheduler/pipeline.py`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `psycopg2.OperationalError` | Check DB credentials in `.env` and that PostgreSQL is running |
| `faiss-cpu` install fails | `pip install faiss-cpu --prefer-binary` |
| Reddit returns 0 articles | Set `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` in `.env` |
| Models download slowly | They cache in `~/.cache/huggingface/`; only downloaded once |
| Out of memory during summarisation | Reduce `models.summary_num_beams` to 1 in `config.yaml` |
| No articles found for topic | Broaden topic keywords or add RSS feeds in `config.yaml` |
