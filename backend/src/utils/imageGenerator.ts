export async function generateCampaignImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const imageResult = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=400&nologo=true`;
  return imageResult;
}
