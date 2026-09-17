import argparse
import sys
from faster_whisper import WhisperModel

def main():
    parser = argparse.ArgumentParser(description="Ashvi Local STT via faster-whisper")
    parser.add_argument("input", help="Path to input audio file")
    parser.add_argument("--model", default="tiny", help="Whisper model size (tiny, base, small)")
    parser.add_argument("--language", default="en", help="Language hint (en, hi)")
    parser.add_argument("--output", default="", help="Path to output transcript file")
    args = parser.parse_args()

    try:
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        lang = args.language if args.language in ["en", "hi"] else None
        segments, _info = model.transcribe(args.input, language=lang, vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(text)

        sys.stdout.write(text)
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"STT_ERROR: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
