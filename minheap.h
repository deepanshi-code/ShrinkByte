#ifndef MINHEAP_H
#define MINHEAP_H

#include "huffman_node.h"

class MinHeap{
    HuffmanNode *heap[256];
    int size;

    public:

    MinHeap();

    void insert(HuffmanNode *node);

    HuffmanNode* extractMin();

    void heapifyUp(int index);

    void heapifyDown(int index);

    int getSize();
};

#endif