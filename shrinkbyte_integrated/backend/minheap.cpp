#include "minheap.h"
#include <stdexcept>
#include <iostream>

using namespace std;

MinHeap::MinHeap() {
    size = 0;
}

bool MinHeap::comesBefore(HuffmanNode *a, HuffmanNode *b) const {
    if (a->frequency != b->frequency)
        return a->frequency < b->frequency;
    return a->id < b->id;
}

void MinHeap::insert(HuffmanNode *node) {
    if (size >= 257) throw overflow_error("MinHeap is full");
    heap[size] = node;
    heapifyUp(size);
    size++;
}

void MinHeap::heapifyUp(int index) {
    while (index > 0) {
        int parent = (index - 1) / 2;
        if (!comesBefore(heap[index], heap[parent])) break;
        HuffmanNode *temp = heap[index];
        heap[index] = heap[parent];
        heap[parent] = temp;
        index = parent;
    }
}

HuffmanNode* MinHeap::extractMin() {
    if (size == 0) return nullptr;
    HuffmanNode *minNode = heap[0];
    size--;
    if (size > 0) {
        heap[0] = heap[size];
        heapifyDown(0);
    }
    return minNode;
}

void MinHeap::heapifyDown(int index) {
    while (true) {
        int smallest = index;
        int left = 2 * index + 1;
        int right = 2 * index + 2;
        if (left < size && comesBefore(heap[left], heap[smallest])) smallest = left;
        if (right < size && comesBefore(heap[right], heap[smallest])) smallest = right;
        if (smallest == index) break;
        HuffmanNode *temp = heap[index];
        heap[index] = heap[smallest];
        heap[smallest] = temp;
        index = smallest;
    }
}

int MinHeap::getSize() const { return size; }

void buildMinHeap(MinHeap& heap, int frequency[256]) {
    for (int i = 0; i < 256; i++) {
        if (frequency[i] > 0) {
            HuffmanNode* newNode = new HuffmanNode((unsigned char)i, frequency[i]);
            heap.insert(newNode);
        }
    }
}

void buildMinHeap(MinHeap& heap, const std::map<unsigned char, int> &frequencyMap) {
    for (const auto &entry : frequencyMap) {
        if (entry.second > 0) {
            HuffmanNode* newNode = new HuffmanNode(entry.first, entry.second);
            heap.insert(newNode);
        }
    }
}

HuffmanNode* buildHuffmanTree(MinHeap& heap) {
    if (heap.getSize() == 0)
        return nullptr;
    unsigned int nextId = 256;
    if (heap.getSize() == 1) {
        HuffmanNode* child = heap.extractMin();
        HuffmanNode* parent = new HuffmanNode(0, child->frequency);
        parent->id = nextId;
        parent->left = child;
        return parent;
    }

    while (heap.getSize() > 1) {
        HuffmanNode* left = heap.extractMin();
        HuffmanNode* right = heap.extractMin();
        HuffmanNode* parent = new HuffmanNode(0, left->frequency + right->frequency);
        parent->id = nextId++;
        parent->left = left;
        parent->right = right;

        heap.insert(parent);
    }

    return heap.extractMin();
}

HuffmanNode* buildHuffmanTree(const map<unsigned char, int> &frequencyMap) {
    MinHeap heap;
    buildMinHeap(heap, frequencyMap);
    return buildHuffmanTree(heap);
}

void freeTree(HuffmanNode* node) {
    if (node == nullptr)
        return;
    freeTree(node->left);
    freeTree(node->right);
    delete node;
}
