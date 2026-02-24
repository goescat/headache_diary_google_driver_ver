from flask import Flask, render_template
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='/static')

@app.route('/')
def index():
    return render_template(
        'index.html',
        google_client_id=os.getenv('GOOGLE_CLIENT_ID', ''),
        drive_file_id_key=os.getenv('DRIVE_FILE_ID_KEY', '')
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)