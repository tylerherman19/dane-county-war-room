import zipfile
import xml.etree.ElementTree as ET
import json
import re

def parse_xlsx(filename):
    with zipfile.ZipFile(filename, 'r') as z:
        # Load shared strings
        shared_strings = []
        try:
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                # Namespace usually looks like {http://schemas.openxmlformats.org/spreadsheetml/2006/main}
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('ns:si', ns):
                    t = si.find('ns:t', ns)
                    shared_strings.append(t.text if t is not None else "")
        except KeyError:
            pass # No shared strings?

        # Load sheet 1
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            rows_data = []
            for row in root.findall('.//ns:row', ns):
                row_vals = []
                for c in row.findall('ns:c', ns):
                    val = ""
                    t_type = c.get('t')
                    v = c.find('ns:v', ns)
                    if v is not None:
                        if t_type == 's': # Shared string
                            idx = int(v.text)
                            if idx < len(shared_strings):
                                val = shared_strings[idx]
                        else:
                            val = v.text
                    row_vals.append(val)
                rows_data.append(row_vals)
            
            return rows_data

data = parse_xlsx('precinct_results.xls')

# Extract relevant data
# Look for header row with "Precinct"
header_idx = -1
for i, row in enumerate(data):
    if row and "Precinct" in str(row[0]):
        header_idx = i
        break

results = []
if header_idx != -1:
    # Identify columns
    headers = data[header_idx]
    # Expected: Precinct, Satya Rhodes-Conway, Gloria Reyes, Write-In
    # But let's just grab indices 0, 1, 2
    
    for row in data[header_idx+1:]:
        if len(row) >= 3:
            precinct = row[0]
            satya = row[1]
            gloria = row[2]
            
            # Clean up
            if precinct and "Total" not in precinct:
                results.append({
                    "ward": precinct,
                    "satya": satya,
                    "gloria": gloria
                })

print(json.dumps(results, indent=2))
