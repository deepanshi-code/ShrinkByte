#ifndef HUFFMAN_ENCODER_H
#define HUFFMAN_ENCODER_H

#include <cstddef>
#include <cstdint>
#include <map>
#include <queue>
#include <string>
#include <vector>

struct HuffmanNode
{
    unsigned char data;
    uint64_t frequency;
    HuffmanNode* left;
    HuffmanNode* right;
    unsigned int id;

    HuffmanNode(unsigned char d, uint64_t f)
        : data(d), frequency(f), left(nullptr), right(nullptr), id(d) {}
};

struct HuffmanNodeCompare
{
    bool operator()(const HuffmanNode* a, const HuffmanNode* b) const
    {
        if (a->frequency != b->frequency)
            return a->frequency > b->frequency;
        return a->id > b->id;
    }
};

HuffmanNode* buildHuffmanTree(const std::map<unsigned char, int>& frequencyMap);

enum class HuffmanStatus
{
    OK = 0,
    INVALID_INPUT,
    FILE_OPEN_FAILED,
    FILE_READ_FAILED,
    FILE_WRITE_FAILED,
    BAD_MAGIC,
    TRUNCATED_DATA,
    SIZE_MISMATCH,
    CORRUPT_DATA,
    NOT_COMPRESSIBLE
};

const char* huffmanStatusToString(HuffmanStatus status);

class HuffmanEncoder
{
private:
    HuffmanNode* root;
    std::map<unsigned char, std::string> huffmanCodes;

    void generateCodes(HuffmanNode* node, std::string& currentCode);
    void freeTree(HuffmanNode* node);

    HuffmanEncoder(const HuffmanEncoder&) = delete;
    HuffmanEncoder& operator=(const HuffmanEncoder&) = delete;

public:
    HuffmanEncoder();
    ~HuffmanEncoder();

    void buildTree(const std::map<unsigned char, int>& frequencyMap);
    void buildCodes();
    std::string encodeStringToBits(const std::string& text);

    HuffmanStatus compressBuffer(const uint8_t* data, size_t len, std::vector<uint8_t>& out);
    HuffmanStatus decompressBuffer(const uint8_t* data, size_t len, std::vector<uint8_t>& out);

    HuffmanStatus compressFile(const std::string& inputFilePath, const std::string& outputFilePath);
    HuffmanStatus decompressFile(const std::string& inputFilePath, const std::string& outputFilePath);

    const std::map<unsigned char, std::string>& getCodes() const;
    HuffmanNode* getRoot() const;
};

#endif
