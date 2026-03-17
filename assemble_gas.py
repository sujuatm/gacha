import re
import os

cwd = r'd:\code\gacha'
output_file = os.path.join(cwd, 'GAS_Index.html')

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def get_svg_content(filename):
    content = read_file(os.path.join(cwd, 'svg', filename))
    # Remove xml header if exists
    content = re.sub(r'<\?xml.*?\?>', '', content)
    # Remove width/height to make it responsive
    content = re.sub(r'width=".*?"', '', content)
    content = re.sub(r'height=".*?"', '', content)
    return content

# Read sources
index_html = read_file(os.path.join(cwd, 'index.html'))
style_css = read_file(os.path.join(cwd, 'style.css'))
config_js = read_file(os.path.join(cwd, 'config.js'))
script_js = read_file(os.path.join(cwd, 'script.js'))

# 1. Replace CSS link
index_html = re.sub(r'<link rel="stylesheet".*?>', f'<style>\n{style_css}\n</style>', index_html)

# 2. Replace JS scripts
# Remove existing script tags for config and script
index_html = re.sub(r'<script src="config\.js"></script>', '', index_html)
index_html = re.sub(r'<script src="script\.js"></script>', '', index_html)
# Insert combined scripts before </body>
combined_js = f'<script>\n{config_js}\n{script_js}\n</script>'
index_html = index_html.replace('</body>', f'{combined_js}\n</body>')

# 3. Inline SVGs
# body_back.svg
svg_back = get_svg_content('body_back.svg')
index_html = re.sub(r'<img src="svg/body_back\.svg.*?" class="(.*?)">', rf'<div class="\1">{svg_back}</div>', index_html)

# balls.svg
svg_balls = get_svg_content('balls.svg')
index_html = re.sub(r'<img src="svg/balls\.svg.*?" class="(.*?)">', rf'<div class="\1">{svg_balls}</div>', index_html)

# body_front.svg
svg_front = get_svg_content('body_front.svg')
index_html = re.sub(r'<img src="svg/body_front\.svg.*?" class="(.*?)">', rf'<div class="\1">{svg_front}</div>', index_html)

# controller.svg
svg_controller = get_svg_content('controller.svg')
index_html = re.sub(r'<img src="svg/controller\.svg.*?" class="(.*?)" id="(.*?)">', rf'<div class="\1" id="\2">{svg_controller}</div>', index_html)

# ball_single.svg
svg_single = get_svg_content('ball_single.svg')
index_html = re.sub(r'<img src="svg/ball_single\.svg.*?" id="(.*?)" class="(.*?)">', rf'<div id="\1" class="\2">{svg_single}</div>', index_html)

# Final cleanup: Ensure API_URL hint is clear (though it already is in config.js)

with open(output_file, 'w', encoding='utf-8') as f:
    f.write(index_html)

print(f"Successfully assembled {output_file}")
