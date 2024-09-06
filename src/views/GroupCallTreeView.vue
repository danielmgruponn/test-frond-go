<template>
    <div>
        <h1>Group Call</h1>
        <br>
        <div>
            <button v-on:click="joinRoom">Join Room</button>
            <button v-on:click="leaveRoom">Leave Room</button>
            <button v-on:click="toggleVideo">Toggle Video</button>
            <div v-for="(stream, peerId) in peerStreams" :key="peerId">
                <video :ref="'video-' + peerId" autoplay playsinline></video>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import { defineComponent } from 'vue';
    import Peer from 'simple-peer';

    export default defineComponent({
        name: "GroupCallTreeView",
        data() {
            return {
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MjU4MTQyMTcsImlkIjozLCJ1c2VybmFtZSI6InRlc3QtMyJ9.rIFTiDmfSWZkJ6qWwhXsUfYvdtf2vC5jcM0829MiMJg',
                socket: null as WebSocket | null,
                peerConnections: {} as { [key: string]: Peer.Instance | null },
                peerStreams: {} as { [key: string]: MediaStream | null },
                localStream: null as MediaStream | null,
                roomId: 'default-room',
                isVideoEnabled: true,
            }
        },
        mounted() {
            this.connectSocket()
        },
        methods: {
            connectSocket(): void {
                this.socket = new WebSocket(`ws://127.0.0.1:8000/ws/group-call/${this.roomId}?token=${this.token}`)
                this.socket.onopen = () => {
                    console.log("Websocket Connected");
                }
                this.socket.onmessage = (event: MessageEvent) => {
                    const mns = JSON.parse(event.data)
                    console.log(mns);
                    
                    switch (mns.type) {
                        case 'user-joined':
                            this.addPeer(mns.userId, true)
                            break;
                        case 'offer':
                            this.handleOffer(mns.from, mns.offer)
                            break;
                        case 'answer':
                            this.handleAnswer(mns.from, mns.answer)
                            break;
                        case 'ice-candidate':
                            this.handleIceCandidate(mns.from, mns.candidate)
                            break;
                        case 'user-left':
                                this.removePeer(mns.userId)
                            break;
                        default:
                            console.log('Tipo de dato no consistente: ', mns.type);
                            break;
                    }
                }
                this.socket.onerror = (error) => {
                    console.error("Socket Error: ", error);
                }
                this.socket.onclose = (event: CloseEvent) => {
                    console.log('Socket is closed. Reconnect will be attempted in 1 second: ', event);
                    setTimeout(() => this.connectSocket(), 1000);
                }
            },
            sendToServe(message: any): void {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    console.log("Sending Message: ", message);
                    this.socket.send(JSON.stringify(message))
                } else {
                    console.error("WebSocket is not Open");
                }
            },
            addPeer(peerId: string, initiator: boolean): void {
                console.log("eee");
                if (!this.localStream) return;
                console.log("rrrr");
                this.peerConnections[peerId] = new Peer({
                    initiator: initiator,
                    stream: this.localStream,
                    trickle: false
                })
                this.peerConnections[peerId]?.on('signal', (data) => {
                    this.sendToServe({
                        type: initiator ? 'offer' : 'answer',
                        to: peerId,
                        [initiator ? 'offer' : 'answer']: data
                    })
                })
                this.peerConnections[peerId]?.on('stream', (stream) => {
                    this.peerStreams[peerId] = stream
                    this.$nextTick(() => {
                        const videoEl = this.$refs[`video-${peerId}`] as unknown as HTMLVideoElement | HTMLVideoElement[];
                        if (Array.isArray(videoEl)) {
                            const videoElement = videoEl[0] as HTMLVideoElement
                            if (videoElement) videoElement.srcObject = stream
                        }
                    })
                })
            },
            handleOffer(peerId: string, offer: any): void {
                this.addPeer(peerId, false)
                this.peerConnections[peerId]!.signal(offer)
            },
            handleAnswer(peerId: string, answer: any): void {
                this.peerConnections[peerId]!.signal(answer)
            },
            handleIceCandidate(peerId: string, candidate: any): void {
                this.peerConnections[peerId]!.signal({
                    type: 'candidate',
                    candidate: candidate })
            },
            removePeer(peerId: string): void {
                if (this.peerConnections[peerId]) {
                    this.peerConnections[peerId]?.destroy()
                    this.peerConnections[peerId] = null
                }
                this.peerStreams[peerId]!.getTracks().forEach(track => track.stop())
                this.peerStreams[peerId] == null
            },

            async joinRoom(): Promise<void>{
                try {
                    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: this.isVideoEnabled })
                    this.sendToServe({type: 'join'})
                } catch (error) {
                    console.error('Error accessing media devices:', error);
                }
            },
            leaveRoom(): void {
                this.sendToServe({
                    type: 'leave'
                })
                Object.keys(this.peerConnections).forEach(peerId => this.removePeer(peerId))
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop())
                    this.localStream = null
                }
            },
            toggleVideo(): void {
                this.isVideoEnabled = !this.isVideoEnabled;
                if (this.localStream) {
                    const videoTrack = this.localStream.getVideoTracks()[0]
                    if (videoTrack) {
                        videoTrack.enabled = this.isVideoEnabled
                    }
                }
            }
        },
    });
</script>