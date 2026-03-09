import os
import string
import numpy as np
import onnxruntime as ort
from PIL import Image
from io import BytesIO

class OnnxSolver:
    def __init__(self, model_path: str = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "captcha.onnx")
        self.model_path = model_path
        
        # Load the ONNX model session once to save time across multiple checks
        self.session = ort.InferenceSession(self.model_path)

    def _decode(self, sequence):
        # The characters array used to map tensor outputs back to ascii
        characters = '-' + string.digits + string.ascii_uppercase
        
        a = ''.join([characters[x] for x in sequence])
        s = ''.join([x for j, x in enumerate(a[:-1]) if x != characters[0] and x != a[j+1]])
        
        if len(s) == 0:
            return ''
        if a[-1] != characters[0] and s[-1] != a[-1]:
            s += a[-1]
            
        return s

    def solve(self, image_bytes: bytes) -> str:
        # Load the image in grayscale/RGB format logic specific to the model 
        img = np.asarray(Image.open(BytesIO(image_bytes)), dtype=np.float32) / 255.0
        img = np.expand_dims(np.transpose(img, (2, 0, 1)), axis=0)
        
        # Run inference
        outputs = self.session.run(None, {'input': img})
        x = outputs[0]
        
        # Decode max probability indices
        t = np.argmax(np.transpose(x, (1, 0, 2)), -1)
        pred = self._decode(t[0])
        
        return pred

# Global singleton so we don't reload the 12MB tensor file into RAM every time
_solver_instance = None

def solve_captcha(image_bytes: bytes) -> str:
    global _solver_instance
    if _solver_instance is None:
        _solver_instance = OnnxSolver()
    return _solver_instance.solve(image_bytes)
