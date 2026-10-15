#ifndef MINHEAP_H
#define MINHEAP_H

#include "huffman_node.h"
#include <map>

class MinHeap {
    HuffmanNode *heap[257];
    int size;
    bool comesBefore(HuffmanNode *a, HuffmanNode *b) const;

public:
    MinHeap();
    void insert(HuffmanNode *node);
    HuffmanNode* extractMin();
    void heapifyUp(int index);
    void heapifyDown(int index);
    int getSize() const;
};

void buildMinHeap(MinHeap& heap, int frequency[256]);
void buildMinHeap(MinHeap &heap, const std::map<unsigned char, int> &frequencyMap);

HuffmanNode* buildHuffmanTree(MinHeap& heap);
HuffmanNode* buildHuffmanTree(const std::map<unsigned char, int> &frequencyMap);

#endif
