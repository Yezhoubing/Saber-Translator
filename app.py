# app.py
import os
from flask import Flask, request, jsonify, render_template
import base64
from PIL import Image
import io
from bubble_detection import detect_text_in_bubbles
import webbrowser
import threading
from openai import OpenAI
import json
import PyPDF2  # 导入 PyPDF2 库
from flask_cors import CORS

app = Flask(__name__, template_folder='templates', static_folder='static', static_url_path='')
CORS(app)

# 定义模型信息文件名
MODEL_INFO_FILE = 'model_info.json'
MAX_MODEL_HISTORY = 5  # 定义每个服务商最多保存的模型历史数量

UPLOAD_FOLDER = 'uploads'  # 定义上传文件夹
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # 确保上传文件夹存在

def open_browser():
    """在应用启动后自动打开浏览器访问指定URL"""
    webbrowser.open_new("http://127.0.0.1:5000/")

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
        text_direction = data.get('textDirection')
        fontSize_str = data.get('fontSize')
        api_key = data.get('api_key')
        model_name = data.get('model_name')
        model_provider = data.get('model_provider')
        fontFamily = data.get('fontFamily') # 获取字体路径

        if not all([image_data, target_language, text_direction, fontSize_str, api_key, model_name, model_provider, fontFamily]):
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
            model_provider,
            api_key=api_key,
            model_name=model_name,
            fontFamily=fontFamily # 传递字体路径
        )

        # 将PIL图像转换为Base64字符串
        buffered = io.BytesIO()
        translated_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

        # 保存模型信息
        save_model_info(model_provider, model_name)

        return jsonify({
            'translated_image': img_str,
            'bubble_texts': bubble_texts,
            'bubble_coords': bubble_coords
        })

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500


def load_model_info():
    """从文件中加载模型信息"""
    try:
        with open(MODEL_INFO_FILE, 'r') as f:
            try:
                model_info = json.load(f)
            except json.JSONDecodeError:
                print("JSON 文件为空或格式不正确，使用默认值")
                model_info = {}
        return model_info
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"加载模型信息失败: {e}")
        return {}


def save_model_info(model_provider, model_name):
    """将模型信息保存到文件, 存储每个服务商的模型列表"""
    model_info = load_model_info() # 加载现有的模型信息

    if model_provider not in model_info:
        model_info[model_provider] = [] # 如果服务商不存在，则创建新的列表

    if model_name and model_name not in model_info[model_provider]: # 避免保存空模型名和重复模型
        model_info[model_provider].insert(0, model_name) # 将新模型添加到列表的开头
        model_info[model_provider] = model_info[model_provider][:MAX_MODEL_HISTORY] # 仅保留最近使用的 MAX_MODEL_HISTORY 个模型

    try:
        with open(MODEL_INFO_FILE, 'w') as f:
            json.dump(model_info, f, indent=2, ensure_ascii=False) # 使用 indent 和 ensure_ascii 使 JSON 文件更易读
    except Exception as e:
        print(f"保存模型信息失败: {e}")

@app.route('/get_used_models', methods=['GET'])
def get_used_models():
    """获取指定服务商的已使用模型列表"""
    model_provider = request.args.get('model_provider')
    if not model_provider:
        return jsonify({'error': '缺少 model_provider 参数'}), 400

    model_info = load_model_info()
    used_models = model_info.get(model_provider, []) # 获取指定服务商的模型列表，如果不存在则返回空列表
    return jsonify({'models': used_models})

@app.route('/get_model_info', methods=['GET'])
def get_model_info():
    """获取模型信息的路由"""
    model_info = load_model_info()
    return jsonify(model_info)

@app.route('/save_model_info', methods=['POST'])
def route_save_model_info():
    """保存模型信息的路由"""
    data = request.get_json()
    if not data or 'modelProvider' not in data or 'modelName' not in data:
        return jsonify({'error': '缺少模型供应商或模型名称'}), 400

    model_provider = data['modelProvider']
    model_name = data['modelName']
    save_model_info(model_provider, model_name)
    return jsonify({'message': '模型信息保存成功'})

def pdf_to_images(pdf_file):
    """将 PDF 文件转换为图像列表"""
    images = []
    try:
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            if '/Resources' in page and '/XObject' in page['/Resources']:  # 确保存在 /Resources 和 /XObject
                xObject = page['/Resources']['/XObject'].get_object()

                for obj in xObject:
                    if xObject[obj]['/Subtype'] == '/Image':
                        try:
                            size = (xObject[obj]['/Width'], xObject[obj]['/Height'])
                            data = xObject[obj].get_data()
                            if xObject[obj]['/ColorSpace'] == '/DeviceRGB':
                                mode = "RGB"
                            else:
                                mode = "P"

                            if '/Filter' in xObject[obj]:
                                if xObject[obj]['/Filter'] == '/FlateDecode':
                                    img = Image.frombytes(mode, size, data)
                                    images.append(img)
                                elif xObject[obj]['/Filter'] == '/DCTDecode':
                                    img = Image.open(io.BytesIO(data))
                                    images.append(img)
                                else:
                                    print("Unknown filter, skipping")
                            else:
                                img = Image.frombytes(mode, size, data)
                                images.append(img)
                        except Exception as image_e:
                            print(f"提取图片失败，页面 {page_num + 1}, 对象 {obj}: {image_e}")  # 打印图片提取失败的详细信息
        return images
    except Exception as e:
        print(f"PDF 转换失败: {e}")
        return []

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    """处理 PDF 文件上传的路由"""
    if 'pdfFile' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400

    pdf_file = request.files['pdfFile']
    if pdf_file.filename == '':
        return jsonify({'error': '文件名为空'}), 400

    if pdf_file:
        try:
            images = pdf_to_images(pdf_file.stream)
            image_data_list = []
            for i, image in enumerate(images):
                try:
                    buffered = io.BytesIO()
                    image.save(buffered, format="PNG")
                    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
                    image_data_list.append(img_str)
                except Exception as save_e:
                    print(f"保存图片失败，跳过图片{i+1}: {save_e}") # 打印图片保存失败的详细信息

            return jsonify({'images': image_data_list}), 200
        except Exception as e:
            print(f"处理 PDF 文件时出错: {e}")
            return jsonify({'error': f"处理 PDF 文件时出错: {e}"}), 500

    return jsonify({'error': '上传失败'}), 500

if __name__ == '__main__':
    threading.Timer(1, open_browser).start()
    print("程序正在运行，请在浏览器中访问 http://127.0.0.1:5000/")
    app.run(debug=True, use_reloader=False)
