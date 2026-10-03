#include<iostream>
#include "minheap.h"

using namespace std;

MinHeap::MinHeap(){
    size=0;
}

void MinHeap::insert(HuffmanNode *node){
    if(size>=256){
        cout<<"Heap is full"<<endl;
        return;
    }

    heap[size]=node;
    size++;

    heapifyUp(size-1);
}

void MinHeap::heapifyUp(int index){
    while(index>0){
        int parent=(index-1)/2;

        if(heap[index]->frequency < heap[parent]->frequency){
            HuffmanNode *temp=heap[index];
            heap[index]=heap[parent];
            heap[parent]=temp;
            index=parent;
        }
        else{
            break;
        }
    }
}

HuffmanNode* MinHeap::extractMin(){
    if(size==0){
        return NULL;
    }


    HuffmanNode *minNode=heap[0];
    heap[0]=heap[size-1];
    size--;

    if(size>0){
        heapifyDown(0);
    }
    return minNode;
} 

void MinHeap::heapifyDown(int index){
    while(true){
        int smallest=index;
        int left=2*index+1;
        int right=2*index+2;

        if(left<size && heap[left]->frequency < heap[smallest]->frequency){
            smallest=left;
        }
        if(right<size && heap[right]->frequency < heap[smallest]->frequency){
            smallest=right;
        }
        if(smallest==index){
            break;
        }

        HuffmanNode *temp=heap[index];
        heap[index]=heap[smallest];
        heap[smallest]=temp;
        index=smallest;
    }
}

int MinHeap::getSize(){
    return size;
}

void buildMinHeap(MinHeap &heap,int frequency[256]){
    for(int i=0;i<256;i++){
        if(frequency[i]>0){
            HuffmanNode *newNode = new HuffmanNode((unsigned char)i,frequency[i]);
            heap.insert(newNode);
        }
    }
}