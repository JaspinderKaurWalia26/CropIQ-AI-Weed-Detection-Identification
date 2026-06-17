from deep_translator import GoogleTranslator

def translate_text(text, target_language):
    """
    Translates given text into the specified target language using Deep Translator.
    Supported target_language examples: 'en', 'hi', 'fr', 'es', etc.
    """
    try:
        translated = GoogleTranslator(source='auto', target=target_language).translate(text)
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # fallback to original if translation fails
