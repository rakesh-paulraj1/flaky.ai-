import { InferenceClient } from "@huggingface/inference";


const client = new InferenceClient(process.env.HF_TOKEN);



export const generatecreative = async (file: File, content: string): Promise<Blob> => {

 const system_prompt = `Create a seamless looping GIF animation for the product. Keep the background completely static and stable. Only the product should have motion - animate the product with smooth, eye-catching movements like floating, rotating, pulsing, or subtle motion effects. The product animation should be professional, modern, and perfect for social media. The loop should be seamless with no jarring transitions. Background must remain still while the product moves elegantly. `

const final_prompt = system_prompt + content;

  const video = await client.imageToVideo({
	provider: "fal-ai",
	model: "Lightricks/LTX-2",
	inputs: file,
	parameters: { prompt: final_prompt, },
});

return video;

}