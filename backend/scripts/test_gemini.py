import os
import sys

# Add the parent directory to sys.path so we can import main.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import parse_media_with_gemini

def test_image_parsing(image_file="test.jpeg"):
    images_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "images"))
    image_path = os.path.join(images_folder, image_file)

    if not os.path.exists(image_path):
        print(f"Test image not found: {image_path}")
        return

    print(f"Parsing image: {image_path}")
    result = parse_media_with_gemini(image_path)
    print("\n=== Gemini Output ===")
    print(result)

if __name__ == "__main__":
    image_file = sys.argv[1] if len(sys.argv) > 1 else "test.jpeg"
    test_image_parsing(image_file)
