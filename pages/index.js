import Layout from '../comps/Layout.js'
import ChooseFile from '../comps/ChooseFile.js'
import ChooseDirectory from '../comps/ChooseDirectory.js'
import {useState} from 'react';
import JSZip from 'jszip';
import { Line } from 'rc-progress';


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// |sleepTimeMs| is the amount of time in ms to sleep between step updates.
const sleepTimeMs = 200;

// |sleepFinalTimeMs| is the amount of time in ms to sleep on the final step.
const sleepFinalTimeMs = 400;

async function unzip(inputFile, outputDirectory, setProgress) {
  try {
    const zip = await JSZip.loadAsync(inputFile);

    // Uncomment to use the user-selected directory handle:
    const output_dir = outputDirectory;
    // Uncomment to use the spec-provided sandbox folder:
    // const output_dir = await FileSystemDirectoryHandle.getSystemDirectory({ type: "sandbox" });
    if (output_dir === null) {
      console.log("No output directory selected, please select an output directory first");
      return;
    }

    // |progress| tracks the current progress indicator value.
    let progress = 0;

    // |progress_step| is the amount of progress we increment by on the
    // progress indicator.  There are progress indicator steps for each entry
    // in the keys array plus the final "100%" bump after the for loop
    // completes.
    let progress_step = 100 / (Object.keys(zip.files).length+1);

    for (const name in zip.files) {
      await sleep(sleepTimeMs);
      progress += progress_step;
      setProgress(progress);
      await sleep(sleepTimeMs);

      const path = name.split('/');
      const file_name = path.pop();
      let dir = output_dir;
      for (const component of path) {
        dir = await dir.getDirectory(component, {create: true});
      }

      const file = zip.files[name];

      // Skip over directories
      if (file.dir) continue;

      const output_file = await dir.getFile(file_name, {create: true});
      const writer = await output_file.createWriter({keepExistingData: false});

      const stream = file.nodeStream();
      // Too bad stream is not a native stream, but instead a node stream
      // with a totally different API...
      let offset = 0;
      let write_op;
      stream.on('data', async chunk => {
          stream.pause();
          write_op = writer.write(offset, chunk);
          await write_op;
          offset += chunk.length;
          stream.resume();
      });
      await new Promise((resolve, reject) => {
          stream.on('error', reject);
          stream.on('end', resolve);
      });
      // Make sure the last write operation actually finished.
      await write_op;
      writer.close();
    };

    await sleep(sleepTimeMs);
    progress += progress_step;
    setProgress(progress);
    await sleep(sleepFinalTimeMs);
  } catch (error) {
      console.error('Failed to load zip file');
      console.error(error);
  }
}

function Unarchive(props) {
  return (
    <div>
      <button onClick={
        async () => {
          props.setRunning(true);
          await unzip(props.inputFile, props.outputDirectory, props.setProgress)
          props.setRunning(false);
          props.reset();
        }
      }>3. Unarchive</button>
    </div>
  )
}

function Index() {
  // Declare a state variable for the input file.
  const [inputFile, setInputFile] = useState(null);

  // Declare a state variable for the output directory handle.
  const [outputDirectory, setOutputDirectory] = useState(null);

  // Declare state variables for tracking running and the progress indicator.
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  function reset() {
    setInputFile(null);
    setOutputDirectory(null);
  }

  return (
    <Layout>
      <div>
        <p>Unarchiver</p>

        <ChooseFile
            inputFile={inputFile}
            setChosenFile={setInputFile} />
        <ChooseDirectory
            chosenDirectory={outputDirectory}
            setChosenDirectory={setOutputDirectory} />
        <Unarchive
            inputFile={inputFile}
            outputDirectory={outputDirectory}
            reset={reset}
            setProgress={setProgress}
            setRunning={setRunning} />
        { running ?
            <Line percent={progress} strokeWidth="1" />
            : ''
        }
      </div>
    </Layout>
  );
}

export default Index;
