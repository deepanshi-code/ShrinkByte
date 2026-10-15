#ifndef FREQUENCY_H
#define FREQUENCY_H

#include <cstddef>
#include <cstdint>
#include <string>

bool calculateFrequency(std::string filename, int frequency[256]);
bool calculateFrequency(const uint8_t *data, size_t len, int frequency[256]);
void displayFrequency(int frequency[256]);

#endif
