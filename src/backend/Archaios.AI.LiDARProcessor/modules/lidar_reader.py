import laspy

class LiDARReader:
    def __init__(self, input_path):
        self.input_path = input_path

    def read(self):
        las = laspy.read(self.input_path)
        return las
