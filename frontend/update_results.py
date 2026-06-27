import os

filepath = r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Results.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # General neon colors
    ('text-[#66fcf1]', 'text-white'),
    ('text-purple-400', 'text-white'),
    ('text-pink-400', 'text-white'),
    ('border-[#66fcf1]', 'border-white'),
    ('bg-[#66fcf1]', 'bg-white'),
    ('bg-[#66fcf1]/10', 'bg-white/10'),
    ('bg-[#66fcf1]/30', 'bg-white/30'),
    ('shadow-[0_0_20px_rgba(102,252,241,0.4)]', 'shadow-lg'),
    ('shadow-[0_0_20px_rgba(102,252,241,0.2)]', 'shadow-md'),
    ('shadow-[0_0_25px_rgba(102,252,241,0.12)]', 'shadow-md'),
    ('shadow-[0_0_50px_rgba(102,252,241,0.05)]', 'shadow-2xl'),
    ('shadow-glow', 'shadow-md'),
    
    # Gradients
    ('bg-gradient-to-r from-purple-500 to-[#66fcf1]', 'bg-white'),
    ('bg-gradient-to-r from-[#66fcf1] to-blue-400', 'bg-white'),
    ('from-transparent via-[#66fcf1]/30 to-transparent', 'from-transparent via-white/10 to-transparent'),
    
    # Buttons and UI tweaks
    ('bg-white text-black font-black', 'bg-white text-black font-bold'),
    ('bg-white text-black text-lg font-black', 'bg-white text-black text-sm font-bold'),
    ('text-[#66fcf1] text-black shadow-glow', 'bg-white text-black shadow-md'),
    ('bg-white/10 text-white hover:bg-white/20', 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'),
    ('glass-panel-dark', 'glass-panel border border-white/5'),
    ('text-3xl md:text-5xl font-black text-white mb-3 flex items-center gap-4 drop-shadow-xl', 'text-3xl md:text-4xl font-bold tracking-tight text-white mb-3 flex items-center gap-4'),
    ('px-10 py-5 bg-black/40 hover:bg-black/60 backdrop-blur-xl border-2 border-white/30 rounded-2xl transition-colors text-lg font-black text-white shadow-xl', 'px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-sm font-bold text-white shadow-lg'),
    
    # Social media pack neon borders
    ('bg-[#25F4EE]/10 border border-[#25F4EE]/30 p-5 rounded-2xl relative group', 'glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors'),
    ('text-[#25F4EE]', 'text-gray-300'),
    ('bg-pink-500/10 border border-pink-500/30 p-5 rounded-2xl relative group', 'glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors'),
    ('text-pink-400', 'text-gray-300'),
    ('bg-red-500/10 border border-red-500/30 p-5 rounded-2xl relative group', 'glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors'),
    ('text-red-400', 'text-gray-300'),
    ('bg-gray-500/10 border border-gray-500/30 p-5 rounded-2xl relative group', 'glass-panel border border-white/10 p-5 rounded-2xl relative group hover:bg-white/5 transition-colors'),
    
    # Modal
    ('bg-[#111] border border-white/10 p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto', 'bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl'),
    ('bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold', 'bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors'),
    ('bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-medium resize-none', 'bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-white focus:outline-none transition-colors resize-none'),
    ('bg-black border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-blue-400', 'bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:border-white focus:outline-none transition-colors'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated Results.tsx")
