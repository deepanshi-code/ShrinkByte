#include "HuffmanEncoderheader1.h"
#include <climits>
#include <fstream>
namespace 
{
const size_t HEADER_SIZE = 4 + 8 + 2;
const size_t ENTRY_SIZE = 1 + 4;
void putU16(std::vector<uint8_t>& v, uint16_t x) 
{
    v.push_back(static_cast<uint8_t>(x & 0xFF));
    v.push_back(static_cast<uint8_t>((x >> 8) & 0xFF));
}
void putU32(std::vector<uint8_t>& v, uint32_t x) 
{
    for (int i = 0; i < 4; ++i) v.push_back(static_cast<uint8_t>((x >> (8 * i)) & 0xFF));
}
void putU64(std::vector<uint8_t>& v, uint64_t x) 
{
    for (int i = 0; i < 8; ++i) v.push_back(static_cast<uint8_t>((x >> (8 * i)) & 0xFF));
}
uint16_t getU16(const uint8_t* p) 
{
    return static_cast<uint16_t>(p[0] | (p[1] << 8));
}
uint32_t getU32(const uint8_t* p) 
{
    uint32_t x = 0;
    for (int i = 0; i < 4; ++i) x |= static_cast<uint32_t>(p[i]) << (8 * i);
    return x;
}
uint64_t getU64(const uint8_t* p) 
{
    uint64_t x = 0;
    for (int i = 0; i < 8; ++i) x |= static_cast<uint64_t>(p[i]) << (8 * i);
    return x;
}
HuffmanStatus readWholeFile(const std::string& path, std::vector<uint8_t>& data)
 {
    data.clear();
    std::ifstream in(path, std::ios::binary);
    if (!in.is_open()) return HuffmanStatus::FILE_OPEN_FAILED;
    in.seekg(0, std::ios::end);
    std::streamoff size = in.tellg();
    if (size < 0) return HuffmanStatus::FILE_READ_FAILED;
    in.seekg(0, std::ios::beg);
    data.resize(static_cast<size_t>(size));
    if (size > 0) 
    {
        in.read(reinterpret_cast<char*>(data.data()), size);
        if (in.gcount() != size) return HuffmanStatus::FILE_READ_FAILED;
    }
    return HuffmanStatus::OK;
}
HuffmanStatus writeWholeFile(const std::string& path, const std::vector<uint8_t>& data) {
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    if (!out.is_open()) return HuffmanStatus::FILE_OPEN_FAILED;
    if (!data.empty()) out.write(reinterpret_cast<const char*>(data.data()), data.size());
    out.close();
    return out.fail() ? HuffmanStatus::FILE_WRITE_FAILED : HuffmanStatus::OK;
}
#ifndef USE_DARSH_TREE
struct CompareNode 
{
    bool operator()(const HuffmanNode* a, const HuffmanNode* b) const 
    {
        if (a->frequency != b->frequency) return a->frequency > b->frequency;
        return a->id > b->id;  // deterministic tie-break
    }
};
HuffmanNode* buildHuffmanTreeFallback(const std::map<unsigned char, int>& freq) 
{
    std::priority_queue<HuffmanNode*, std::vector<HuffmanNode*>, CompareNode> heap;
    for (const auto& p : freq) heap.push(new HuffmanNode(p.first, p.second));
    unsigned int nextId = 256;
    while (heap.size() > 1) 
    {
        HuffmanNode* l = heap.top(); heap.pop();
        HuffmanNode* r = heap.top(); heap.pop();
        HuffmanNode* parent = new HuffmanNode(0, l->frequency + r->frequency);
        parent->id = nextId++;
        parent->left = l;
        parent->right = r;
        heap.push(parent);
    }
    return heap.top();
}
#endif

}  

const char* huffmanStatusToString(HuffmanStatus status) 
{
    switch (status) 
    {
        case HuffmanStatus::OK:                return "OK";
        case HuffmanStatus::INVALID_INPUT:     return "Invalid input";
        case HuffmanStatus::FILE_OPEN_FAILED:  return "Could not open file";
        case HuffmanStatus::FILE_READ_FAILED:  return "Could not read file";
        case HuffmanStatus::FILE_WRITE_FAILED: return "Could not write file";
        case HuffmanStatus::BAD_MAGIC:         return "Bad magic: not a ShrinkByte (SB01) file";
        case HuffmanStatus::TRUNCATED_DATA:    return "Truncated data: file ends too early";
        case HuffmanStatus::SIZE_MISMATCH:     return "Size mismatch between header and data";
        case HuffmanStatus::CORRUPT_DATA:      return "Corrupt data";
    }
    return "Unknown error";
}

HuffmanEncoder::HuffmanEncoder() : root(nullptr) {}

HuffmanEncoder::~HuffmanEncoder() 
{
    freeTree(root);
}

void HuffmanEncoder::freeTree(HuffmanNode* node) 
{
    if (!node) return;
    freeTree(node->left);
    freeTree(node->right);
    delete node;
}

void HuffmanEncoder::buildTree(const std::map<unsigned char, int>& frequencyMap) 
{
    if (root) 
    {
        freeTree(root);
        root = nullptr;
    }
    huffmanCodes.clear();

    if (frequencyMap.empty()) return;
    if (frequencyMap.size() == 1) 
    {
        const auto& p = *frequencyMap.begin();
        HuffmanNode* child = new HuffmanNode(p.first, p.second);
        root = new HuffmanNode(0, child->frequency);
        root->left = child;
        root->right = nullptr;
        return;
    }
#ifdef USE_DARSH_TREE
    MinHeap heap;
    for (const auto& pair : frequencyMap)
        heap.insert(new HuffmanNode(pair.first, pair.second));
    root = buildHuffmanTree(heap); 
#else
    root = buildHuffmanTreeFallback(frequencyMap);
#endif
}

void HuffmanEncoder::generateCodes(HuffmanNode* node, const std::string& currentCode) 
{
    if (!node) return;
    if (!node->left && !node->right) 
    {
        huffmanCodes[node->data] = currentCode.empty() ? "0" : currentCode;
        return;
    }
    if (node->left) generateCodes(node->left, currentCode + "0");
    if (node->right) generateCodes(node->right, currentCode + "1");
}

void HuffmanEncoder::buildCodes() 
{
    huffmanCodes.clear();
    if (root) generateCodes(root, "");
}
std::string HuffmanEncoder::encodeStringToBits(const std::string& text) 
{
    std::string encodedBits;
    for (unsigned char ch : text) {
        auto it = huffmanCodes.find(ch);
        if (it == huffmanCodes.end()) return "";
        encodedBits += it->second;
    }
    return encodedBits;
}
HuffmanStatus HuffmanEncoder::compressBuffer(const uint8_t* data, size_t len, std::vector<uint8_t>& out) {
    out.clear();
    if (!data && len > 0) return HuffmanStatus::INVALID_INPUT;
    if (len > static_cast<size_t>(INT_MAX)) return HuffmanStatus::INVALID_INPUT;  

    std::map<unsigned char, int> freqMap;
    for (size_t i = 0; i < len; ++i) freqMap[data[i]]++;

    buildTree(freqMap);
    buildCodes();

    out.reserve(HEADER_SIZE + freqMap.size() * ENTRY_SIZE + len / 2 + 16);

    const char MAGIC[4] = {'S', 'B', '0', '1'};
    for (int i = 0; i < 4; ++i) out.push_back(static_cast<uint8_t>(MAGIC[i]));
    putU64(out, static_cast<uint64_t>(len));
    putU16(out, static_cast<uint16_t>(freqMap.size()));
    for (const auto& pair : freqMap) 
    {
        out.push_back(pair.first);
        putU32(out, static_cast<uint32_t>(pair.second));
    }

    const std::string* table[256] = {nullptr};
    for (const auto& pair : huffmanCodes) table[pair.first] = &pair.second;

    uint8_t bitBuffer = 0;
    int bitCount = 0;
    for (size_t i = 0; i < len; ++i) 
    {
        const std::string* code = table[data[i]];
        if (!code) return HuffmanStatus::CORRUPT_DATA;  
        for (char bit : *code) 
        {
            bitBuffer = static_cast<uint8_t>((bitBuffer << 1) | (bit == '1' ? 1 : 0));
            if (++bitCount == 8) {
                out.push_back(bitBuffer);
                bitBuffer = 0;
                bitCount = 0;
            }
        }
    }
    if (bitCount > 0) {
        bitBuffer = static_cast<uint8_t>(bitBuffer << (8 - bitCount));
        out.push_back(bitBuffer);
    }
    return HuffmanStatus::OK;
}
HuffmanStatus HuffmanEncoder::decompressBuffer(const uint8_t* data, size_t len, std::vector<uint8_t>& out) {
    out.clear();
    if (!data && len > 0) return HuffmanStatus::INVALID_INPUT;
    if (len < 4) return HuffmanStatus::TRUNCATED_DATA;
    const char MAGIC[4] = {'S', 'B', '0', '1'};
    for (int i = 0; i < 4; ++i)
        if (data[i] != static_cast<uint8_t>(MAGIC[i])) return HuffmanStatus::BAD_MAGIC;

    if (len < HEADER_SIZE) return HuffmanStatus::TRUNCATED_DATA;
    uint64_t originalSize = getU64(data + 4);
    uint16_t uniqueCount = getU16(data + 12);
    if (uniqueCount > 256) return HuffmanStatus::CORRUPT_DATA;

    size_t tableEnd = HEADER_SIZE + static_cast<size_t>(uniqueCount) * ENTRY_SIZE;
    if (len < tableEnd) return HuffmanStatus::TRUNCATED_DATA;

    std::map<unsigned char, int> freqMap;
    uint64_t freqSum = 0;
    size_t pos = HEADER_SIZE;
    for (uint16_t i = 0; i < uniqueCount; ++i) 
    {
        unsigned char ch = data[pos];
        uint32_t freq = getU32(data + pos + 1);
        pos += ENTRY_SIZE;
        if (freq == 0 || freq > static_cast<uint32_t>(INT_MAX)) return HuffmanStatus::CORRUPT_DATA;
        if (freqMap.count(ch)) return HuffmanStatus::CORRUPT_DATA;  
        freqMap[ch] = static_cast<int>(freq);
        freqSum += freq;
    }
    if (freqSum != originalSize) return HuffmanStatus::SIZE_MISMATCH;
    if (originalSize == 0) return HuffmanStatus::OK;  

    size_t payloadBytes = len - tableEnd;
    if (originalSize / 8 > payloadBytes) return HuffmanStatus::TRUNCATED_DATA;
    out.reserve(static_cast<size_t>(originalSize));

    buildTree(freqMap);
    if (!root) return HuffmanStatus::CORRUPT_DATA;

    HuffmanNode* node = root;
    for (size_t i = tableEnd; i < len && out.size() < originalSize; ++i) 
    {
        for (int b = 7; b >= 0 && out.size() < originalSize; --b) 
        {
            int bit = (data[i] >> b) & 1;
            node = bit ? node->right : node->left;
            if (!node) { out.clear(); return HuffmanStatus::CORRUPT_DATA; }
            if (!node->left && !node->right) 
            {
                out.push_back(node->data);
                node = root;
            }
        }
    }

    if (out.size() != originalSize) {
        out.clear();
        return HuffmanStatus::TRUNCATED_DATA;
    }
    return HuffmanStatus::OK;
}

HuffmanStatus HuffmanEncoder::compressFile(const std::string& inputFilePath, const std::string& outputFilePath) {
    std::vector<uint8_t> input, output;
    HuffmanStatus s = readWholeFile(inputFilePath, input);
    if (s != HuffmanStatus::OK) return s;
    s = compressBuffer(input.data(), input.size(), output);
    if (s != HuffmanStatus::OK) return s;
    return writeWholeFile(outputFilePath, output);
}

HuffmanStatus HuffmanEncoder::decompressFile(const std::string& inputFilePath, const std::string& outputFilePath) {
    std::vector<uint8_t> input, output;
    HuffmanStatus s = readWholeFile(inputFilePath, input);
    if (s != HuffmanStatus::OK) return s;
    s = decompressBuffer(input.data(), input.size(), output);
    if (s != HuffmanStatus::OK) return s;
    return writeWholeFile(outputFilePath, output);
}

const std::map<unsigned char, std::string>& HuffmanEncoder::getCodes() const {
    return huffmanCodes;
}

HuffmanNode* HuffmanEncoder::getRoot() const {
    return root;
}
