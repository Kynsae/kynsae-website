import struct
import sys
import argparse

def convert_ply(input_path, output_path, ascii_format=False):
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

    required = ['x', 'y', 'z']
    for attr in required:
        if attr not in index_map:
            print(f"❌ Missing required attribute: {attr}")
            return

    if ascii_format:
        # Prepare ASCII header
        new_header = [
            "ply",
            "format ascii 1.0",
            f"element vertex {vertex_count}",
            "property float x",
            "property float y",
            "property float z",
            "end_header"
        ]
        
        # Write ASCII output
        with open(output_path, 'w') as f:
            f.write("\n".join(new_header) + "\n")
            
            # Process vertices
            for line in lines[header_end_index + 1 : header_end_index + 1 + vertex_count]:
                parts = line.strip().split()
                
                try:
                    x = float(parts[index_map['x']])
                    y = float(parts[index_map['y']])
                    z = float(parts[index_map['z']])
                    
                    # Write as ASCII
                    f.write(f"{x} {y} {z}\n")
                    
                except (ValueError, IndexError) as e:
                    print(f"⚠️ Skipping invalid line: {line.strip()} ({e})")
        
        print(f"✅ Saved clean ASCII PLY to: {output_path}")
    else:
        # Prepare binary header
        new_header = [
            "ply",
            "format binary_little_endian 1.0",
            f"element vertex {vertex_count}",
            "property float x",
            "property float y",
            "property float z",
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

                    # Pack as little-endian binary: 3 floats
                    binary_data = struct.pack('<fff', x, y, z)
                    f.write(binary_data)

                except (ValueError, IndexError) as e:
                    print(f"⚠️ Skipping invalid line: {line.strip()} ({e})")

        print(f"✅ Saved clean binary PLY to: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Convert PLY file to clean format with only x, y, z coordinates')
    parser.add_argument('input', help='Input PLY file path')
    parser.add_argument('output', help='Output PLY file path')
    parser.add_argument('--ascii', '-a', action='store_true', help='Keep output in ASCII format (default: binary)')
    
    args = parser.parse_args()
    convert_ply(args.input, args.output, ascii_format=args.ascii)