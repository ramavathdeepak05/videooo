# Generates the voiceover lines with Kokoro (open-source neural TTS).
import json, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
M='/home/user/tools/'
k=Kokoro(M+'kokoro-v1.0.onnx',M+'voices-v1.0.bin')
VOICE=sys.argv[1] if len(sys.argv)>1 else 'af_heart'
LINES=[
 "Placement season. Resumes, skills, mock interviews, deadlines...",
 "and no idea what to work on next.",
 "Meet XplorePro.",
 "One AI-powered ecosystem for students, colleges, and employers.",
 "Your AI career mentor learns your profile, spots your skill gaps, and builds a roadmap that's truly yours.",
 "Score your resume against real ATS filters.",
 "Practise AI interviews, from HR, to technical, to coding rounds.",
 "Colleges run AI-proctored assessments that hold up to scrutiny.",
 "And employers hire pre-assessed talent, with evidence before the first interview.",
 "XplorePro. Readiness, assessment, training and hiring. All connected.",
 "Book a demo at XplorePro dot AI.",
]
out=[]
for i,l in enumerate(LINES):
    a,sr=k.create(l,voice=VOICE,speed=1.08,lang='en-us')
    # trim silence
    nz=np.where(np.abs(a)>0.01)[0]; a=a[max(0,nz[0]-240):nz[-1]+2400]
    sf.write(f'/home/user/videooo/xplorepro-video/audio/vo_{i:02d}.wav',a,sr)
    out.append({'i':i,'text':l,'dur':round(len(a)/sr,3),'sr':sr})
    print(i,round(len(a)/sr,2),l)
json.dump(out,open('/home/user/videooo/xplorepro-video/audio/vo.json','w'),indent=1)
