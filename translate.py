from openai import OpenAI
import sys  # 导入 sys 模块

def translate_to_chinese(text, api_key, model):
    """
    使用 OpenAI 将日语翻译成中文。

    Args:
        text: 要翻译的日语文本。
        api_key: OpenAI API 密钥.
        model: 要使用的模型名称.

    Returns:
        翻译后的中文文本。
    """
    client = OpenAI(api_key=api_key, base_url="https://api.siliconflow.cn/v1") # 或者其他你使用的 base URL

    response = client.chat.completions.create(
        model=model,  # 使用传递的模型
        messages=[
            {"role": "system", "content": "你是一个翻译助手，将用户输入的日语翻译成简洁流畅的中文."},
            {"role": "user", "content": text},
        ],
        stream=False # 这里为了简化代码，先禁用 streaming
    )

    # 非流式输出，直接返回结果
    translated_text = response.choices[0].message.content.strip()
    return translated_text

if __name__ == "__main__":
    # 从命令行参数获取 api_key, model 和 text
    if len(sys.argv) != 4:
        print("Usage: python translate.py <api_key> <model> <text>")
        sys.exit(1)

    api_key = sys.argv[1]
    model = sys.argv[2]
    japanese_text = sys.argv[3] # 从命令行获取要翻译的文本

    chinese_translation = translate_to_chinese(japanese_text, api_key, model)
    print(chinese_translation) # 只打印翻译结果
