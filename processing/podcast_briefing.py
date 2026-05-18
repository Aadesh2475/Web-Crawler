import os
import json
from datetime import datetime, timedelta
from utils.logger import get_logger
from utils.redis_client import redis_client
from storage.db import Article
from rag.gemini_client import GeminiClient

logger = get_logger(__name__)

class PodcastBriefingEngine:
    def __init__(self, db_manager):
        self.db = db_manager
        self.gemini = GeminiClient()

    def generate_briefing_script(self) -> dict:
        # Get top 5 relevant articles from the past 24 hours
        cutoff = datetime.utcnow() - timedelta(days=1)
        with self.db.SessionFactory() as session:
            articles = (
                session.query(Article)
                .filter(Article.is_relevant == True, Article.created_at >= cutoff)
                .order_by(Article.relevance_score.desc())
                .limit(5)
                .all()
            )

        if not articles:
            # Fallback to last 3 days if past 24 hours is empty
            cutoff = datetime.utcnow() - timedelta(days=3)
            with self.db.SessionFactory() as session:
                articles = (
                    session.query(Article)
                    .filter(Article.is_relevant == True, Article.created_at >= cutoff)
                    .order_by(Article.relevance_score.desc())
                    .limit(5)
                    .all()
                )

        if not articles:
            return {
                "script": "Welcome to the Daily Intelligence Briefing. Currently, there are no new global affairs news signals in our database to report. All crawler systems are online, and standard monitoring remains active.",
                "stories": []
            }

        stories = []
        for a in articles:
            stories.append({
                "title": a.title,
                "summary": a.summary or a.cleaned_content[:200],
                "source": a.source or "OSINT Core"
            })

        prompt = f"""
Generate a concise, professional, radio-quality news script for a 2-minute "Daily Intelligence Briefing".
Aggregated Stories:
{json.dumps(stories, indent=2)}

Guidelines:
1. Speak in an authoritative, objective geopolitical and financial news anchor persona.
2. Start with a premium intro: "Good day, this is the Daily Intelligence Briefing from WebMining ML. Here are the top global affairs developments..."
3. Seamlessly transition between the top stories, summarizing their systemic significance.
4. End with an outro: "This concludes your briefing. Stay informed with WebMining ML."
5. Write the script exactly as it should be read by a text-to-speech engine. Do not include sound effect labels like [Music] or [Anchor].
6. Keep the total length to around 250-300 words.

Return ONLY the raw script text.
"""

        system_instruction = "You are a professional geopolitical radio newscast producer. Your goal is to write a highly polished, engaging, and authoritative audio intelligence briefing script."

        logger.info("Generating podcast briefing script via Gemini...")
        try:
            script = self.gemini.generate_content(prompt, system_instruction)
        except Exception as e:
            logger.error(f"Gemini generate_content exception: {e}")
            script = "Error: Exception raised during generation."

        if not script or script.strip().startswith("Error"):
            logger.warning("Gemini generation failed or quota exceeded. Constructing premium programmatic script fallback...")
            
            # Start script with a premium anchor introduction
            intro = "Good day, this is the Daily Intelligence Briefing from WebMining ML. Here are the top global affairs developments we are tracking. "
            
            body_parts = []
            transition_phrases = [
                "First, we look at a critical development. ",
                "In another major development, ",
                "Next, turning our attention to key industry shifts, ",
                "Additionally, we are tracking reports that ",
                "Finally, in geopolitical and market news, "
            ]
            
            for idx, s in enumerate(stories):
                title = s["title"].strip()
                if not title.endswith(('.', '!', '?')):
                    title += "."
                
                source = s["source"].strip()
                summary = s["summary"].strip()
                
                # Make the summary sound spoken: take the first 1 or 2 sentences
                sentences = [sent.strip() for sent in summary.split('.') if sent.strip()]
                short_summary = ""
                if len(sentences) > 0:
                    short_summary = sentences[0] + "."
                    if len(sentences) > 1:
                        short_summary += " " + sentences[1] + "."
                else:
                    short_summary = summary
                
                transition = transition_phrases[idx % len(transition_phrases)]
                body_parts.append(f"{transition}From {source}: {title} {short_summary}")
                
            body = " ".join(body_parts)
            outro = " This concludes your daily briefing. Stay informed with WebMining ML."
            script = intro + body + outro

        return {
            "script": script.strip(),
            "stories": [{"title": s["title"], "source": s["source"]} for s in stories]
        }

    def synthesize_briefing_audio(self, script: str, output_path: str) -> bool:
        """
        Synthesize text-to-speech audio using edge-tts (Authoritative Neural Voice)
        with standard fallback to gtts.
        """
        logger.info(f"Synthesizing audio for briefing to: {output_path} ...")

        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Try edge-tts first for ultra-realistic neural anchor voice (free and doesn't require keys!)
        try:
            import edge_tts  # type: ignore
            import asyncio

            async def run_edge_tts():
                # en-US-GuyNeural sounds like a professional news anchor
                communicate = edge_tts.Communicate(script, "en-US-GuyNeural", rate="+0%")
                await communicate.save(output_path)

            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            if loop.is_running():
                try:
                    import nest_asyncio  # type: ignore
                    nest_asyncio.apply()
                except ImportError:
                    pass
                loop.run_until_complete(run_edge_tts())
            else:
                loop.run_until_complete(run_edge_tts())

            logger.info("edge-tts synthesis completed successfully.")
            return True
        except Exception as e:
            logger.warning(f"edge-tts failed or is not installed: {e}. Trying fallback to gTTS...")

        # Fallback to gtts
        try:
            from gtts import gTTS  # type: ignore
            tts = gTTS(text=script, lang='en', tld='com')
            tts.save(output_path)
            logger.info("gTTS fallback synthesis completed successfully.")
            return True
        except Exception as e:
            logger.error(f"TTS synthesis failed completely (edge-tts and gtts): {e}")
            return False
