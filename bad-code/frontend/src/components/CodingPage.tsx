import { useEffect, useState } from 'react';
import { Editor } from './Editor';
import Split from "react-split";
import { File, RemoteFile, Type } from './external/editor/utils/file-manager';
import { useSearchParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { Output } from './Output';
import { TerminalComponent as Terminal } from './Terminal';
import { Socket, io } from 'socket.io-client';
import { EXECUTION_ENGINE_URI } from '../config';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh; /* Full height for Split to work properly */
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end; /* Aligns children (button) to the right */
  padding: 10px; /* Adds some space around the button */
`;

const Toolbar = styled.div`
  /* Example toolbar styling */
  width: 100%;
  background-color: #333;
  color: white;
  padding: 0.5rem 1rem;
  display: flex;
  justify-content: center; /* Center the button horizontally */
  align-items: center; /* Vertically align button */
  gap: 1rem; /* Add space between elements if needed */
`;

const Workspace = styled.div`
  flex: 1;              /* Occupies all remaining vertical space */
  display: flex;        /* We let react-split handle horizontal layout */
  flex-direction: row; /* Just a container. react-split will float on top. */
`;

const LeftPanel = styled.div`
  flex: 1;
  width: 60%;
`;

const RightPanel = styled.div`
  flex: 1;
  width: 40%;
`;

const Pane = styled.div`
    height: 100%;
    width: 100%;
    overflow: auto; /* Ensure panes handle content overflow */
`;

function useSocket(replId: string) {
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(`${EXECUTION_ENGINE_URI}?roomId=${replId}`);
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [replId]);

    return socket;
}

export const CodingPage = () => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    const [loaded, setLoaded] = useState(false);
    const socket = useSocket(replId);
    const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [showOutput, setShowOutput] = useState(false);

    useEffect(() => {
        if (socket) {
            socket.on('loaded', ({ rootContent }: { rootContent: RemoteFile[]}) => {
                setLoaded(true);
                setFileStructure(rootContent);
            });
        }
    }, [socket]);

    const onSelect = (file: File) => {
        if (file.type === Type.DIRECTORY) {
            socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => {
                setFileStructure(prev => {
                    const allFiles = [...prev, ...data];
                    return allFiles.filter((file, index, self) => 
                        index === self.findIndex(f => f.path === file.path)
                    );
                });
            });

        } else {
            socket?.emit("fetchContent", { path: file.path }, (data: string) => {
                file.content = data;
                setSelectedFile(file);
            });
        }
    };
    
    if (!loaded) {
        return "Loading...";
    }

    return (
        // <Container>
        //      <ButtonContainer>
        //         <button onClick={() => setShowOutput(!showOutput)}>See output</button>
        //     </ButtonContainer>
        //     <Workspace>
        //         <LeftPanel>
        //             <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
        //         </LeftPanel>
        //         <RightPanel>
        //             {showOutput && <Output />}
        //             <Terminal socket={socket} />
        //         </RightPanel>
        //     </Workspace>
        // </Container>

        <Container>
            <ButtonContainer>
                <Toolbar>
                    {/* Put your run button, environment dropdown, save status, etc. */}
                    <button onClick={() => setShowOutput(!showOutput)}>Run</button>
                </Toolbar>
            </ButtonContainer>
            <Workspace>
                <Split
                    sizes={[60, 40]}
                    direction="horizontal" // Horizontal split
                    gutterSize={8} // Size of the gutter
                    style={{ display: "flex", width: "100%", height: "100%" }}
                >
                    <Pane>
                        <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
                    </Pane>
                    {/* Right Pane: Terminal + Output */}
                    <Split
                        sizes={[50, 50]} // Split Terminal and Output equally
                        direction="vertical" // Vertical split
                        gutterSize={8}
                        style={{ width: "100%", height: "100%" }} // Allow split to grow and fit container
                    >
                        {/* Top Pane: Terminal */}
                        <Pane>
                            <Terminal socket={socket} />
                        </Pane>

                        {/* Bottom Pane: Output */}
                        <Pane>
                            {showOutput && <Output />}
                        </Pane>
                    </Split>
                </Split>
            </Workspace>
        </Container>
    );
}
