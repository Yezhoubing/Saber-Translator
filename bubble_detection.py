import torch
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import manga_ocr
import os
from openai import OpenAI

# 加载YOLOv5模型
model = torch.hub.load('ultralytics/yolov5', 'custom', path="weights/best.pt")
model.conf = 0.6

# --- 修改部分：指定本地 Manga OCR 模型路径 ---
# 获取当前文件 (bubble_detection.py) 所在的目录
current_dir = os.path.dirname(os.path.abspath(__file__))
# 构建模型文件夹的完整路径 (假设模型文件夹名为 manga_ocr_model)
model_path = os.path.join(current_dir, "manga_ocr_model")

# 检查模型文件夹是否存在
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Manga OCR 模型文件夹未找到：{model_path}。请确保已下载模型文件并将其放在正确的位置。")

# 使用本地模型路径初始化 Manga OCR
ocr = manga_ocr.MangaOcr(model_path)  # 修改这里
# --- 修改部分结束 ---


def translate_text(text, target_language, model_provider, api_key=None, model_name=None):
    prompt_content = "你是一个好用的翻译助手。请将我的日文翻译成中文，将所有非中文的翻译成中文。我发给你所有的话都是需要翻译的内容，你只需要回答翻译结果。翻译结果请符合中文的语言习惯。"

    if model_provider == 'siliconflow':
        client = OpenAI(api_key=api_key, base_url="https://api.siliconflow.cn/v1")
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": prompt_content},
                    {"role": "user", "content": text},
                ],
                timeout=10
            )
            translated_text = response.choices[0].message.content.strip()
            return translated_text
        except Exception as e:
            print(f"翻译 API 请求失败: {e}")
            return "翻译失败"
    elif model_provider == 'deepseek':
        client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": prompt_content},
                    {"role": "user", "content": text},
                ],
                timeout=10
            )
            translated_text = response.choices[0].message.content.strip()
            return translated_text
        except Exception as e:
            print(f"DeepSeek 翻译 API 请求失败: {e}")
            return "翻译失败"
    else:
        print(f"未知的翻译模型提供商: {model_provider}")
        return text

def draw_multiline_text_vertical_right_to_left(draw, text, font, x, y, max_height, fill='black'):
    """
    竖向排版，从右向左绘制自动换行的文本，列内文字保持自然阅读顺序（从上到下）
    """
    if not text:
        return

    lines = []
    current_line = ""
    current_column_height = 0
    line_height = font.size + 5

    for char in text:
        bbox = font.getbbox(char)
        char_height = bbox[3] - bbox[1]

        if current_column_height + line_height <= max_height:
            current_line += char
            current_column_height += line_height
        else:
            lines.append(current_line)
            current_line = char
            current_column_height = line_height

    lines.append(current_line)

    current_x = x
    column_width = font.size + 5

    for line in lines:
        current_y = y
        for char in line:
            draw.text((current_x, current_y), char, font=font, fill=fill, anchor="rt")
            current_y += line_height
        current_x -= column_width

def detect_text_in_bubbles(image, target_language='zh', text_direction='vertical', fontSize=30, model_provider='siliconflow', api_key=None, model_name=None):
    """
    Detects text in speech bubbles and draws bounding boxes around them, filling with translated text, 只支持竖向排版，从右向左.
    """
    try:
        # Convert PIL Image to OpenCV format
        img_np = np.array(image)
        img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # Perform inference
        results = model(img_cv)

        # Extract bounding boxes, scores, and class IDs
        boxes = results.xyxy[0][:, :4].cpu().numpy()
        scores = results.xyxy[0][:, 4].cpu().numpy()
        class_ids = results.xyxy[0][:, 5].cpu().numpy()
        valid_detections = scores > model.conf
        boxes = boxes[valid_detections]
        scores = scores[valid_detections]
        class_ids = class_ids[valid_detections]
        bubble_texts = []
        bubble_coords = []

        # Process each detected bubble,  按照气泡框从右到左排序
        for i in range(len(boxes)):
            x1, y1, x2, y2 = map(int, boxes[i])
            bubble_coords.append((x1, y1, x2, y2))

        # Sort bubbles by x-coordinate of the right edge (x2) in descending order (right to left)
        bubble_coords.sort(key=lambda x: x[2], reverse=True)

        for x1, y1, x2, y2 in bubble_coords:
            bubble_img = img_cv[y1:y2, x1:x2]
            bubble_img_pil = Image.fromarray(cv2.cvtColor(bubble_img, cv2.COLOR_BGR2RGB))
            text = ocr(bubble_img_pil)
            translated_text = translate_text(text, target_language, model_provider, api_key=api_key, model_name=model_name)
            bubble_texts.append(translated_text)

        # Draw bounding boxes and text on the image
        img_pil = image.copy()
        draw = ImageDraw.Draw(img_pil)

        # Load font
        font_path = "static/STXINGKA.TTF"
        font_size = int(fontSize)
        try:
            font = ImageFont.truetype(font_path, font_size, encoding="utf-8")
        except IOError as e:
            font = ImageFont.load_default()
            print(f"使用默认字体,因为发生以下错误：{e}")
        except Exception as e:
            print(f"加载字体时发生未知错误: {e}")

        if font is None:
            print("警告：未能成功加载字体，请检查字体路径和文件是否正确")

        # Draw translated text in each bubble
        for i, (x1, y1, x2, y2) in enumerate(bubble_coords):
            # Draw a white rectangle
            draw.rectangle(((x1, y1), (x2, y2)), fill='white')

            # Calculate text position and draw text based on direction
            text_x = x2 - 10  # 右侧起始 x 坐标
            text_y = y1 + 10  # 顶部起始 y 坐标 (留出边距)
            max_text_height = y2 - y1 - 20  # 气泡内部可用高度

            # Draw text vertically from right to left
            draw_multiline_text_vertical_right_to_left(draw, bubble_texts[i], font, text_x, text_y, max_text_height)

        # Convert back to PIL Image
        img_with_bubbles_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        img_with_bubbles_pil = Image.fromarray(cv2.cvtColor(img_with_bubbles_cv, cv2.COLOR_BGR2RGB))

        return img_with_bubbles_pil, bubble_texts, bubble_coords

    except Exception as e:
        print(f"Error in detect_text_in_bubbles: {e}")
        return image, [], []
