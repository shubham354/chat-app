import subprocess
import threading
import json
from flask_socketio import emit

class ErlangBridge:
    def __init__(self, socketio):
        self.socketio = socketio
        self.erlang_node = None
        self.start_erlang_node()

    def start_erlang_node(self):
        cmd = ["erl", "-noshell", "-name", "python@localhost", "-setcookie", "mycookie", "-s", "chat_server", "start_link"]
        self.erlang_node = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Start a thread to read output from Erlang
        threading.Thread(target=self.read_erlang_output, daemon=True).start()

    def read_erlang_output(self):
        while True:
            output = self.erlang_node.stdout.readline()
            if output:
                try:
                    message = json.loads(output.decode().strip())
                    self.socketio.emit('message', message)
                except json.JSONDecodeError:
                    print(f"Invalid JSON received from Erlang: {output}")

    def send_message(self, message, group):
        cmd = f'chat_server:send_message({json.dumps(message)}, "{group}").'
        self.erlang_node.stdin.write(cmd.encode() + b'\n')
        self.erlang_node.stdin.flush()

    def join_group(self, client_id, group):
        cmd = f'chat_server:join_group("{client_id}", "{group}").'
        self.erlang_node.stdin.write(cmd.encode() + b'\n')
        self.erlang_node.stdin.flush()

    def leave_group(self, client_id, group):
        cmd = f'chat_server:leave_group("{client_id}", "{group}").'
        self.erlang_node.stdin.write(cmd.encode() + b'\n')
        self.erlang_node.stdin.flush()

erlang_bridge = None

def init_erlang_bridge(socketio):
    global erlang_bridge
    erlang_bridge = ErlangBridge(socketio)
    return erlang_bridge