import os
import json
import uuid
import urllib.parse
import urllib.request
import asyncio
from groq import Groq
from dotenv import load_dotenv
import edge_tts
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips, VideoFileClip

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

def break_story_into_scenes(story, style, max_scenes=10):
    """Uses Groq to break the story into scenes."""
    client = Groq(api_key=GROQ_API_KEY)
    
    prompt = f"""
    You are an expert video director. Break down the following story into up to {max_scenes} discrete scenes for a short video.
    For each scene, provide:
    1. 'narration': The exact text to be spoken by the narrator.
    2. 'image_prompt': A highly detailed, descriptive prompt for an AI image generator to visualize this scene in a '{style}' style. Be very descriptive about the lighting, subject, and environment.
    
    Respond ONLY with a valid JSON object containing a single key "scenes" which maps to an array of scene objects. No markdown, no explanations.
    Format:
    {{
      "scenes": [
        {{"narration": "...", "image_prompt": "..."}}
      ]
    }}
    
    STORY:
    {story}
    """
    
    print("[StoryVideoMaker] Sending story to Groq for scene generation...")
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="llama-3.3-70b-versatile",
        temperature=0.7,
        response_format={"type": "json_object"}
    )
    
    result = chat_completion.choices[0].message.content
    data = json.loads(result)
    return data.get("scenes", [])

def generate_image(prompt, output_path, width=1080, height=1920):
    """Generates an image using Pollinations.ai"""
    print(f"[StoryVideoMaker] Generating image for prompt: {prompt[:50]}...")
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={uuid.uuid4().int % 100000}"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    return output_path

async def generate_audio(text, output_path, voice="en-US-ChristopherNeural"):
    """Generates TTS audio using edge-tts"""
    print(f"[StoryVideoMaker] Generating audio for: {text[:50]}...")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    return output_path

def create_video_clip(image_path, audio_path, output_path):
    """Combines image and audio into a single MP4 clip using MoviePy"""
    print(f"[StoryVideoMaker] Creating video clip: {output_path}")
    audio_clip = AudioFileClip(audio_path)
    # The image is static, its duration is the same as the audio
    image_clip = ImageClip(image_path).with_duration(audio_clip.duration)
    
    video = image_clip.with_audio(audio_clip)
    video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac", logger=None)
    return output_path

async def compile_story_video(story, style="Cinematic", voice="en-US-ChristopherNeural", aspect_ratio="9:16", output_filename="final_story.mp4", output_dir=None, progress_cb=None):
    """Main workflow to generate the story video."""
    width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080) if aspect_ratio == "16:9" else (1080, 1080)
    
    if output_dir is None:
        output_dir = os.path.join(os.getcwd(), "temp_story")
    os.makedirs(output_dir, exist_ok=True)
    
    if progress_cb: progress_cb(20, "Breaking down story into scenes...")
    scenes = break_story_into_scenes(story, style)
    
    clips = []
    
    total_scenes = len(scenes)
    for i, scene in enumerate(scenes):
        if progress_cb: progress_cb(20 + int(60 * (i/total_scenes)), f"Generating scene {i+1} of {total_scenes}...")
        
        img_path = os.path.join(output_dir, f"scene_{i}.jpg")
        audio_path = os.path.join(output_dir, f"scene_{i}.mp3")
        clip_path = os.path.join(output_dir, f"scene_{i}.mp4")
        
        generate_image(scene["image_prompt"], img_path, width, height)
        await generate_audio(scene["narration"], audio_path, voice)
        
        create_video_clip(img_path, audio_path, clip_path)
        clips.append(clip_path)
        
    if progress_cb: progress_cb(85, "Concatenating scenes into final video...")
    print("[StoryVideoMaker] Concatenating clips...")
    video_clips = [VideoFileClip(clip) for clip in clips]
    
    final_video = concatenate_videoclips(video_clips, method="compose")
    final_output = os.path.join(output_dir, output_filename)
    final_video.write_videofile(final_output, fps=24, codec="libx264", audio_codec="aac")
    print(f"[StoryVideoMaker] Finished! Video saved to: {final_output}")
    return final_output

if __name__ == "__main__":
    sample_story = "In a distant future, the neon-lit city of Neo-Veridia stood as the last bastion of humanity. Cyber-enhanced guards patrolled the misty streets."
    asyncio.run(compile_story_video(sample_story, "Cyberpunk", "en-US-ChristopherNeural", "9:16", "neo_veridia.mp4"))
