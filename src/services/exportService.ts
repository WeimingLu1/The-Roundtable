import type { SavedDiscussion } from '@/types';

export function exportToMarkdown(discussion: SavedDiscussion): string {
  const { topic, participants, messages, summary, createdAt } = discussion;

  const date = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const participantNames = participants.map((p) => p.name).join(', ');

  const lines: string[] = [
    `# ${topic}`,
    '',
    `**Date:** ${date}`,
    `**Participants:** ${participantNames}`,
    '',
    '---',
    '',
    '## Transcript',
    '',
  ];

  for (const msg of messages) {
    const sender =
      msg.senderId === 'user'
        ? 'You'
        : participants.find((p) => p.id === msg.senderId)?.name || 'Unknown';

    lines.push(`**${sender}:**`);
    lines.push(msg.text);
    lines.push('');
  }

  if (summary) {
    lines.push('---');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`**Topic:** ${summary.topic}`);
    lines.push('');
    lines.push('### Core Viewpoints');
    for (const cv of summary.core_viewpoints) {
      lines.push(`- **${cv.speaker}:** ${cv.point}`);
    }
    lines.push('');
    lines.push('### Open Questions');
    for (const q of summary.questions) {
      lines.push(`- ${q}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Exported from The Roundtable*');

  return lines.join('\n');
}

export function exportToPDF(discussion: SavedDiscussion): void {
  const markdown = exportToMarkdown(discussion);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${discussion.topic}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #1a1a2e; border-bottom: 2px solid #a78bfa; padding-bottom: 10px; }
    h2 { color: #1a1a2e; margin-top: 30px; }
    h3 { color: #4a4a6a; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    .meta { color: #666; font-size: 0.9em; }
    .message { margin-bottom: 20px; }
    .sender { font-weight: bold; color: #1a1a2e; }
    .question { color: #666; margin-left: 20px; }
    @media print {
      body { margin: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <h1>${discussion.topic}</h1>
  <p class="meta">
    <strong>Date:</strong> ${new Date(discussion.createdAt).toLocaleDateString()}<br>
    <strong>Participants:</strong> ${discussion.participants.map((p) => p.name).join(', ')}
  </p>

  <hr>

  <h2>Transcript</h2>
  ${discussion.messages
    .map((msg) => {
      const sender =
        msg.senderId === 'user'
          ? 'You'
          : discussion.participants.find((p) => p.id === msg.senderId)?.name || 'Unknown';
      return `<div class="message"><span class="sender">${sender}:</span><p>${msg.text.replace(/\n/g, '<br>')}</p></div>`;
    })
    .join('')}

  ${
    discussion.summary
      ? `
  <hr>
  <h2>Summary</h2>
  <p><strong>Topic:</strong> ${discussion.summary.topic}</p>
  <h3>Core Viewpoints</h3>
  <ul>
    ${discussion.summary.core_viewpoints.map((cv) => `<li><strong>${cv.speaker}:</strong> ${cv.point}</li>`).join('')}
  </ul>
  <h3>Open Questions</h3>
  <ul>
    ${discussion.summary.questions.map((q) => `<li>${q}</li>`).join('')}
  </ul>
  `
      : ''
  }

  <hr>
  <p style="color: #999; font-size: 0.8em; text-align: center;">Exported from The Roundtable</p>
</body>
</html>
  `.trim();

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
}
