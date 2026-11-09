from PIL import Image;import glob,os
for f in sorted(glob.glob('out/*.png')):
  im=Image.open(f); print(os.path.basename(f), im.size, im.mode, os.path.getsize(f)//1024,'KB')
  im.resize((540,960),Image.LANCZOS).save('p-'+os.path.basename(f))
