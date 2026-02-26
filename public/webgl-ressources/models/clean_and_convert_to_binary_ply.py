import struct
import sys

def convert_float_to_uchar(c_linear):
    c_linear = float(c_linear)
    if c_linear <= 0.0031308:
        srgb = 12.92 * c_linear
    else:
        srgb = 1.055 * (c_linear ** (1/2.4)) - 0.055
    return int(round(srgb * 255))

def convert_ply(input_path, output_path):
    with open(input_path, 'r') as f:
        lines = f.readlines()

    header_end_index = None
    vertex_count = 0
    attribute_names = []

    for i, line in enumerate(lines):
        if line.startswith("element vertex"):
            vertex_count = int(line.split()[-1])
        elif line.startswith("property"):
            attribute_names.append(line.strip().split()[-1])
        elif line.strip() == "end_header":
            header_end_index = i
            break

    if header_end_index is None:
        print("❌ Invalid PLY file: missing 'end_header'")
        return

    # Input attribute indices
    index_map = {name: idx for idx, name in enumerate(attribute_names)}

    required = ['x', 'y', 'z', 'col_r', 'col_g', 'col_b']
    for attr in required:
        if attr not in index_map:
            print(f"❌ Missing required attribute: {attr}")
            return

    # Prepare new binary header
    new_header = [
        "ply",
        "format binary_little_endian 1.0",
        f"element vertex {vertex_count}",
        "property float x",
        "property float y",
        "property float z",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
        "end_header\n"
    ]
    new_header_bytes = "\n".join(new_header).encode('utf-8')

    # Write binary output
    with open(output_path, 'wb') as f:
        f.write(new_header_bytes)

        # Process vertices
        for line in lines[header_end_index + 1 : header_end_index + 1 + vertex_count]:
            parts = line.strip().split()

            try:
                x = float(parts[index_map['x']])
                y = float(parts[index_map['y']])
                z = float(parts[index_map['z']])

                r = convert_float_to_uchar(parts[index_map['col_r']])
                g = convert_float_to_uchar(parts[index_map['col_g']])
                b = convert_float_to_uchar(parts[index_map['col_b']])

                # Pack as little-endian binary: 3 floats + 3 uchars
                binary_data = struct.pack('<fffBBB', x, y, z, r, g, b)
                f.write(binary_data)

            except (ValueError, IndexError) as e:
                print(f"⚠️ Skipping invalid line: {line.strip()} ({e})")

    print(f"✅ Saved clean binary PLY to: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage:\n  python convert_ascii_to_clean_binary_ply.py input_ascii.ply output_binary.ply")
    else:
        convert_ply(sys.argv[1], sys.argv[2])