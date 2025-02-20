from flask import Flask, request, jsonify, render_template
import base64
from PIL import Image
import io
from bubble_detection import detect_text_in_bubbles
import webbrowser
import threading

app = Flask(__name__, template_folder='templates', static_folder='static', static_url_path='')

def open_browser():
    """在应用启动后自动打开浏览器访问指定URL"""
    webbrowser.open_new("http://127.0.0.1:5000/")  # 替换为你希望自动打开的URL

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/translate_image', methods=['POST'])
def translate_image():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请求体不能为空'}), 400

        image_data = data.get('image')
        target_language = data.get('target_language')
        text_direction = data.get('textDirection', 'vertical')
        fontSize_str = data.get('fontSize')
        api_key = data.get('api_key')
        model_name = data.get('model_name')

        if not all([image_data, target_language, fontSize_str, api_key, model_name]):
            return jsonify({'error': '缺少必要的参数'}), 400

        try:
            fontSize = int(fontSize_str)
            if fontSize <= 0:
                return jsonify({'error': '字号大小必须是正整数'}), 400
        except ValueError:
            return jsonify({'error': '字号大小必须是整数'}), 400

        img = Image.open(io.BytesIO(base64.b64decode(image_data)))
        translated_image, bubble_texts, bubble_coords = detect_text_in_bubbles(
            img,
            target_language,
            text_direction,
            fontSize,
            api_key=api_key,
            model_name=model_name
        )

        # 将PIL图像转换为Base64字符串
        buffered = io.BytesIO()
        translated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

        return jsonify({
            'translated_image': img_str,
            'bubble_texts': bubble_texts,
            'bubble_coords': bubble_coords
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 使用 threading 在应用启动后延迟打开浏览器
    threading.Timer(1, open_browser).start()  # 延迟1秒打开浏览器
    print("程序正在运行，请在浏览器中访问 http://127.0.0.1:5000/") # 在控制台显示地址
    app.run(debug=True, use_reloader=False) # debug=True 方便开发，use_reloader=False 避免重复打开浏览器

