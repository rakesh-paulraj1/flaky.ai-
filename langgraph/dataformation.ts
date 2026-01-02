export function format_content(content:string){
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                          content.match(/```\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        return JSON.parse(jsonStr)
}