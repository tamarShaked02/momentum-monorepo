export async function generateCampaignImage(prompt: string): Promise<string> {
  const cleanPrompt = prompt.replace(/["<>&]/g, "").slice(0, 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="campaignGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4F46E5" />
        <stop offset="50%" stop-color="#7C3AED" />
        <stop offset="100%" stop-color="#EC4899" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#campaignGrad)" />
    <circle cx="512" cy="420" r="180" fill="#FFFFFF" opacity="0.15" />
    <text x="512" y="440" font-family="system-ui, sans-serif" font-size="40" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Campaign Visual Asset</text>
    <text x="512" y="510" font-family="system-ui, sans-serif" font-size="22" fill="#E0E7FF" text-anchor="middle">${cleanPrompt}</text>
  </svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
