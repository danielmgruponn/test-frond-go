<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <h1>User Two</h1>
    <br>
    <div>
      <button v-on:click="startCall">Call</button>
      <button v-on:click="endCall">End Call</button>
      <button v-on:click="startVideoCall">Video Call</button>
      <button v-on:click="chargeCall">Charge Call</button>
      <audio ref="remoteAudio" autoplay></audio>
      <video ref="remoteVideo" autoplay style="display: none;"></video>
    </div>
    <div>
      <input type="text" v-model="mns" placeholder="message">
      <button v-on:click="sendMessage">Send</button>
      <br>
      <ul>
        <li v-for="(item, index) in allMns" :key="index">{{ item.message }}</li>
      </ul>
    </div>
  </div>
</template>
<script lang="ts">
import axios from 'axios';
import { defineComponent } from 'vue';
import Peer from 'simple-peer'
interface MessageData {
  to: number,
  from: number,
  message: string
}
export default defineComponent({
  name: 'AboutView',
  data() {
    return {
      mns: '',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjQ5NDgwODIsImlkIjoyLCJ1c2VybmFtZSI6InRvYmlhczAxIn0.QzmVZNQzNayqDljji2L_W55igkv_hiI-dYz38aVnqYA',
      allMns: [] as MessageData[],
      socket: null as WebSocket | null,
      socketCall: null as WebSocket | null,
      peerConnection: null as Peer.Instance | null,
      localStream: null as MediaStream | null,
      videoCall: false
    }
  },
  mounted() {
    this.getMyMessage()
    this.connectSocket()
    this.setupSignaling()
  },
  methods: {
    async getMyMessage(): Promise<void> {
      const messages = await axios.get('http://127.0.0.1:8000/api/messages', { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` } })
      const elements = messages.data
      // @ts-expect-error: este error de tipado del cuerpo
      elements.forEach(element => {
        const item: MessageData = {
          to: element.ReceiverID,
          from: element.SenderID,
          message: element.Body
        }
        this.allMns.push(item)
      });
    },
    connectSocket(): void {
      this.socket = new WebSocket(`ws://127.0.0.1:8000/ws?token=${this.token}`)
      this.socket.onopen = () => {
        console.log('WebSocket connected');
      };
      this.socket.onmessage = (event: MessageEvent) => {
        const mns = JSON.parse(event.data)
        console.log(mns);
        if (mns.Event === 'chat') {
          this.allMns.push({
            to: mns.ReceiverID,
            from: mns.SenderID,
            message: mns.Content
          })
          const receiver = {
            event: 'receiver_mns',
            mns_id: mns.ID
          }
          this.sendNewMessage(receiver)
        }
      }
      this.socket.onerror = (error) => {
        console.error("Socket Error: ", error);
      }
      this.socket.onclose = (event: CloseEvent) => {
        console.log('Socket is closed. Reconnect will be attempted in 1 second: ', event);
      }
    },
    sendMessage(): void {
      const message = {
        event: 'chat',
        sender_id: 2,
        receiver_id: 1,
        content: this.mns,
        aes_key_sender: 'wwwww',
        aes_key_receiver: 'eeeeee',
        type: '0',
        status: '1'
      };
      this.sendNewMessage(message)
    },
    sendNewMessage(message: any): void {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('Sending message:', message);
        this.socket.send(JSON.stringify(message));
        this.mns = '';
      } else {
        console.error('WebSocket is not open');
      }
    },
    setupSignaling(): void {
      this.socketCall = new WebSocket(`ws://127.0.0.1:8000/ws/webrtc?token=${this.token}`)
      this.socketCall.onopen = () => {
        console.log('WebSocket connection established');
      }
      this.socketCall.onmessage = (event: MessageEvent) => {
        const message = JSON.parse(event.data)
        if (message.type === 'signal' && message.signal) {
          if (message.signal) {
            if (this.peerConnection) {
              console.log("SIGNAL");
              this.peerConnection.signal(message.signal);
            } else {
              console.log('Peer not initialized, creating new peer: ', message);
              console.log("NOT SIGNAL");
              this.handleIncomingCall(message);
            }
          } else {
            console.error('Received signal message without signal data');
          }
        }
        if (message.type === 'video-call' && message.signal) {
          if (message.signal) {
            if (this.peerConnection) {
              console.log("VIDEO CALL");
              this.peerConnection.signal(message.signal);
            } else {
              console.log('Peer not initialized, creating new peer: ', message);
              console.log("NOT VIDEO CALL");
              this.handleIncomingVideoCall(message);
            }
          } else {
            console.error('Received signal message without signal data');
          }
        }
        if (message.type === 'end') {
          console.log("END");
          this.endCall();
        }
      }
    },
    async startCall(): Promise<void> {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        this.peerConnection = new Peer({
          initiator: true,
          stream: this.localStream,
          trickle: false
        });
        this.peerConnection.on('signal', (data) => {
          this.sendSignalingMessage({
            type: 'signal',
            signal: data,
            to: '1'
          })
        })
        this.peerConnection.on('stream', (stream) => {
          if (this.$refs.remoteAudio) {
            (this.$refs.remoteAudio as HTMLAudioElement).srcObject = stream
          }
        })
        console.log('Peer Audio created:', this.peerConnection);
      } catch (error) {
        console.error('Error in startCall:', error);
      }
    },
    async startVideoCall(): Promise<void> {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        this.peerConnection = new Peer({
          initiator: true,
          stream: this.localStream,
          trickle: false
        });
        this.peerConnection.on('signal', (data) => {
          this.sendSignalingMessage({
            type: 'video-call',
            signal: data,
            to: '1'
          })
        })
        this.peerConnection.on('stream', (stream) => {
          if (this.$refs.remoteVideo) {
            (this.$refs.remoteVideo as HTMLVideoElement).srcObject = stream
          }
          if (this.$refs.remoteAudio) {
            (this.$refs.remoteAudio as HTMLAudioElement).style.display = 'none'
          }
          if (this.$refs.remoteVideo) {
            (this.$refs.remoteVideo as HTMLVideoElement).style.display = 'block'
          }
        })
        console.log('Peer Audio created:', this.peerConnection);
      } catch (error) {
        console.error('Error in startCall:', error);
      }
    },
    sendSignalingMessage(message: any): void {
      if (this.socketCall && this.socketCall.readyState === WebSocket.OPEN) {
        console.log('Sending signal message:', message);
        this.socketCall.send(JSON.stringify(message))
      } else {
        console.error('WebSocket is not open');
      }
    },
    async chargeCall(): Promise<void> {
      if (this.socketCall && this.socketCall.readyState === WebSocket.OPEN) {
        await this.endCall().finally(async () => {
          setTimeout(async () => {
            if (!this.videoCall) {
              await this.startVideoCall()
            } else {
              await this.startCall()
            }
          }, 1500);
        })
      }
    },
    async handleIncomingCall(message: any): Promise<void> {
      if (confirm('Llamada entrante. ¿Aceptar?')) {
        await this.getMediaAudio(message)
      }
    },
    async getMediaAudio(message: any): Promise<void>{
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
        this.localStream = stream;
        this.peerConnection = new Peer({
          initiator: false,
          stream: stream,
          trickle: false
        });
        this.peerConnection.on('signal', (data) => {
          this.sendSignalingMessage({
            type: 'signal',
            signal: data,
            to: message.from
          });
        });
        this.peerConnection.on('stream', (remoteStream) => {
          if (this.$refs.remoteAudio) {
            (this.$refs.remoteAudio as HTMLAudioElement).srcObject = remoteStream;
          }
        });
        if (message.signal) {
          this.peerConnection.signal(message.signal);
        }
      }).catch(error => {
        console.error('Error accessing media devices:', error);
      });
    },
    async handleIncomingVideoCall(message: any): Promise<void> {
      if (confirm('Video llamada entrante. ¿Aceptar?')) {
        await this.getMediaVideo(message)
      }
    },
    async getMediaVideo(message: any): Promise<void> {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        this.localStream = stream;
        this.peerConnection = new Peer({
          initiator: false,
          stream: stream,
          trickle: false
        });
        this.peerConnection.on('signal', (data) => {
          this.sendSignalingMessage({
            type: 'video-call',
            signal: data,
            to: message.from
          });
        });
        this.peerConnection.on('stream', (remoteStream) => {
          if (this.$refs.remoteVideo) {
            (this.$refs.remoteVideo as HTMLVideoElement).srcObject = remoteStream;
          }
          if (this.$refs.remoteAudio) {
            (this.$refs.remoteAudio as HTMLAudioElement).style.display = 'none'
          }
          if (this.$refs.remoteVideo) {
            (this.$refs.remoteVideo as HTMLVideoElement).style.display = 'block'
          }
        });
        if (message.signal) {
          this.peerConnection.signal(message.signal);
        }
      }).catch(error => {
        console.error('Error accessing media devices:', error);
      });
    },
    async endCall(): Promise<void> {
      if (this.peerConnection) {
        this.sendSignalingMessage({
          type: 'end',
          signal: null,
          to: "1"
        })
        await this.peerConnection.destroy()
        this.peerConnection = null
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
        if (this.$refs.remoteAudio) {
          (this.$refs.remoteAudio as HTMLAudioElement).style.display = 'block'
        }
        if (this.$refs.remoteVideo) {
          (this.$refs.remoteVideo as HTMLVideoElement).style.display = 'none'
        }
      }
      if (this.socketCall) {
        this.socketCall.close();
        this.socketCall = null;
      }
      setTimeout(() => {
        console.log('Attempting to reconnect WebSocket for calls...');
        this.setupSignaling();
      }, 1000);
    },
  },
});
</script>