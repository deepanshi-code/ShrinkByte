#ifndef HUFFMAN_ENCODER_H
#define HUFFMAN_ENCODER_H

#include <cstddef>
#include <cstdint>
#include <map>
#include <queue>
#include <string>
#include <vector>
#ifdef USE_DARSH_TREE
#include "huffman_node.h"
#include "minheap.h"
#else
struct HuffmanNode 
{
    unsigned char data;
    int frequency;
    HuffmanNode* left;
    HuffmanNode* right;
    unsigned int id;  

    HuffmanNode(unsigned char d, int f)
        : data(d), frequency(f), left(nullptr), right(nullptr), id(d) {}
};
#endif

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
    CORRUPT_DATA        
};

const char* huffmanStatusToString(HuffmanStatus status);

class HuffmanEncoder 
{
private:
    HuffmanNode* root;
    std::map<unsigned char, std::string> huffmanCodes;

    void generateCodes(HuffmanNode* node, const std::string& currentCode);
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
