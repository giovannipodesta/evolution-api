
import urllib.request
import base64
import json

url = "http://localhost:8080/instance/connect/evento-ef"
headers = {
    "apikey": "evento2025secret"
}

try:
    print(f"Requesting QR from {url}...")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
        data = json.loads(response.read().decode())
        
        base64_img = ""
        if isinstance(data, dict):
             if 'base64' in data:
                 base64_img = data['base64']
             elif 'code' in data:
                 base64_img = data['code']
        else:
             # If response is not JSON, might be raw string (unlikely if properly decoded but handling just in case)
             pass

        if "base64," in base64_img:
            base64_img = base64_img.split("base64,")[1]
            
        if base64_img:
            img_data = base64.b64decode(base64_img)
            output_path = "/Users/encuentrafacil/.gemini/antigravity/brain/728d50a6-5b4d-410b-ac12-04a23d0c8f37/qr_code.png"
            with open(output_path, "wb") as f:
                f.write(img_data)
            print(f"QR code saved to {output_path}")
        else:
            print("No base64 image found in response")
            print(data)

except Exception as e:
    print(f"Error: {e}")
