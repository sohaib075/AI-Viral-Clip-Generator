import os
import glob

# Files to update
target_files = [
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Projects.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Analytics.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Settings.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Accounts.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\HowItWorks.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\pages\Processing.tsx",
    r"d:\professional practice for cv\AI video Clip\frontend\src\App.tsx",
]

replacements = [
    # Global tweaks
    ('selection:bg-[#66fcf1]', 'selection:bg-white'),
    ('text-[#66fcf1]', 'text-white'),
    ('border-[#66fcf1]', 'border-white'),
    ('bg-[#66fcf1]', 'bg-white'),
    ('bg-[#66fcf1]/10', 'bg-white/10'),
    ('bg-[#66fcf1]/20', 'bg-white/20'),
    ('bg-[#66fcf1]/5', 'bg-white/5'),
    ('shadow-[0_0_15px_rgba(102,252,241,0.5)]', 'shadow-md'),
    ('shadow-[0_0_20px_rgba(102,252,241,0.4)]', 'shadow-lg'),
    ('shadow-[0_0_20px_rgba(102,252,241,0.2)]', 'shadow-md'),
    ('shadow-[0_0_30px_rgba(102,252,241,0.3)]', 'shadow-lg'),
    ('shadow-[0_0_50px_rgba(102,252,241,0.2)]', 'shadow-2xl'),
    ('shadow-glow', 'shadow-md'),
    
    # Gradients & Colors
    ('from-purple-500', 'from-white/10'),
    ('to-pink-500', 'to-white/5'),
    ('from-pink-500', 'from-white/10'),
    ('to-purple-500', 'to-white/5'),
    ('bg-purple-500', 'bg-white'),
    ('bg-pink-500', 'bg-white'),
    ('text-purple-400', 'text-white'),
    ('text-pink-400', 'text-white'),
    ('text-blue-400', 'text-white'),
    ('border-purple-500', 'border-white'),
    ('border-pink-500', 'border-white'),
    ('bg-purple-500/10', 'bg-white/10'),
    ('bg-purple-500/20', 'bg-white/20'),
    ('bg-pink-500/10', 'bg-white/10'),
    ('bg-pink-500/20', 'bg-white/20'),
    
    # Text adjustments for contrast
    ('text-white drop-shadow-md', 'text-white tracking-tight'),
    ('font-black', 'font-bold'),
]

for filepath in target_files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for old, new in replacements:
            content = content.replace(old, new)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"File not found: {filepath}")

print("Done bulk updating UI pages.")
