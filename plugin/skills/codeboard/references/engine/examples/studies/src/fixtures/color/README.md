# ICC import fixtures

These locally generated 6×1 PNGs contain the same six source sRGB RGBA8 samples:

```
255,0,0,255   0,255,0,192   0,0,255,128
124,151,201,64   128,128,128,0   255,255,255,255
```

Sharp 0.35.5 / libvips 8.18.7 / LittleCMS 2.19.1 generated each file using
`sharp(rgba, {raw: {width: 6, height: 1, channels: 4}})` followed by
`toColourspace(depth === 16 ? 'rgb16' : 'srgb').withIccProfile(profile).png()`.
`profile` is `srgb` or `p3`; `depth` is 8 or 16. These are fixed import fixtures,
not regenerated using the decoder under test. P3 conversion can introduce
rounding; the study allows three RGB code values and requires exact alpha.

`invalid-profile.png` replaces the P3 16-bit file's iCCP chunk with a compressed
128-byte zero profile and a valid PNG chunk CRC. It must be rejected rather than
silently treated as untagged artwork. The sample strips contain no external art.
