const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { OpenAI } = require('openai');
const chalk = require('chalk').default;
const { highlight } = require('cli-highlight');
const { marked } = require('marked');
const TerminalRenderer = require('marked-terminal').default;

require('dotenv').config();

marked.setOptions({
  renderer: new TerminalRenderer()
});

function formatReply(reply) {
  return reply.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'plaintext';
    return chalk.yellow('\n[code snippet]\n') + highlight(code, { language, ignoreIllegals: true });
  });
}

const folderPaths = process.env.FOLDER_PATHS.split(',').map(p => p.trim());
const model = process.env.MODEL;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Recursively read files from a directory
function readFilesRecursively(dirPath) {
  let filesData = [];

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      filesData = filesData.concat(readFilesRecursively(fullPath));
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      filesData.push({ path: fullPath, content });
    }
  }

  return filesData;
}

// Prepare system message from files
function createSystemMessage(files) {
  let message = "Here is the context from the files:\n\n";
  files.forEach(file => {
    message += `---\nFile: ${file.path}\n${file.content}\n\n`;
  });
  return message;
}

// Start CLI
async function startChat() {

  let files = [];
  folderPaths.forEach(folder => {
    if (fs.existsSync(folder)) {
      files = files.concat(readFilesRecursively(folder));
    } else {
      console.warn(`Folder not found: ${folder}`);
    }
  });

  const systemMessage = createSystemMessage(files);


  // console.log("systemMessage.length", systemMessage.length);

  const messages = [
    { role: 'system', content: systemMessage }
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("Chat started. Ask your questions:");

  rl.on('line', async (input) => {
    messages.push({ role: 'user', content: input });

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: messages
      });

      const reply = response.choices[0].message.content;
      messages.push({ role: 'assistant', content: reply });
      // console.log("\nBot:\n" + formatReply(reply));
      console.log("\nBot:\n" + marked(reply));
    } catch (err) {
      console.error("Error:", err);
    }

    rl.prompt();
  });

  rl.prompt();
}

startChat();

