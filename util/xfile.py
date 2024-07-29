import hashlib


def get_file_hash(file):
    md5_hash = hashlib.md5()
    md5_hash.update(file.read())
    file.seek(0)
    return md5_hash.hexdigest()


def calculate_md5_for_files(file_list):
    hashes = []
    for file in file_list:
        file_hash = get_file_hash(file.file)
        hashes.append(file_hash)

    sorted_hashes = sorted(hashes)
    combined_hash_string = ''.join(sorted_hashes)
    md5 = hashlib.md5()
    md5.update(combined_hash_string.encode('utf-8'))
    return md5.hexdigest()
